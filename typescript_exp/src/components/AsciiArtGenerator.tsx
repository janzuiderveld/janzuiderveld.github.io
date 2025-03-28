import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { 
  renderFormattedText, 
  renderTextString, 
  FontName 
} from './ASCII_text_renderer';

const selectedCharacterSet = "$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/|()1{}[]?-_+~i!lI;:,^`'. ";
const characterSetLength = selectedCharacterSet.length;
const SCALE_FACTOR = 10;
const FRAME_DURATION = 1000 / 60; // Target 60 FPS

const BORDER_FREQUENCY = 0.05;  // Reduced from 0.2 for slower waves
const HORIZONTAL_PADDING = 0;  // Changed from 5 to 0 to remove whitespace borders

const CHAR_WIDTH = SCALE_FACTOR * 0.6;  // Adjust multiplier to match actual character width
const CHAR_HEIGHT = SCALE_FACTOR;

const BLOB_RADIUS = 12;  // Increased from 8 for larger blobs
const BLOB_PADDING = 15; // Increased from 15 to accommodate larger blobs

const GRID_CELL_SIZE = 4; // Cell size for spatial partitioning
const BLOB_CACHE_GRID_SIZE = 4; // Size of cells in the blob cache grid

// Add browser detection at the top with the other constants
const IS_SAFARI = typeof navigator !== 'undefined' && 
                 /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

// Safari-specific adjustments - use larger values for better hit detection
const SAFARI_LINK_Y_OFFSET = IS_SAFARI ? 5 : 0; // Pixels
const SAFARI_CURSOR_Y_OFFSET = IS_SAFARI ? -3 : 0; // Pixels - increased from -2 to -3

interface AsciiArtGeneratorProps {
  textContent: Array<{
    text: string, 
    x: number, // Interpreted as percentage of page width (0-100)
    y: number, // Interpreted as percentage of page height (0-100)
    fontName?: FontName, // 'regular', 'ascii', or 'smallAscii'
    preRenderedAscii?: string,
    fixed?: boolean,
    maxWidthPercent?: number,
    alignment?: 'left' | 'center' | 'right',
    usePercentPosition?: boolean, // Optional flag to support both positioning systems
    centered?: boolean // Add centered property to fix the linter error
  }>;
  maxScrollHeight?: number;
}

interface TextPositionCache {
  [key: string]: {
    startX: number;
    endX: number;
    y: number;
    char: string;
    fixed: boolean;
  }[];
}

// Add link tracking interface
interface LinkPosition {
  textKey: string;
  url: string;
  startX: number;
  endX: number;
  y: number;
}

const AsciiArtGenerator = ({ textContent, maxScrollHeight }: AsciiArtGeneratorProps) => {
    const textRef = useRef<HTMLPreElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const lastFrameTimeRef = useRef<number>(0);
    const [size, setSize] = useState<{ height: number | null; width: number | null }>({ height: null, width: null });
    
    // Add state for link overlays
    const [linkOverlays, setLinkOverlays] = useState<Array<{
        url: string;
        style: React.CSSProperties;
    }>>([]);
    
    // Scroll state
    const [scrollOffset, setScrollOffset] = useState(0);
    const scrollOffsetRef = useRef(0);
    const isScrolling = useRef(false);
    const scrollVelocity = useRef(0);
    const lastScrollTime = useRef(0);
    
    // Link state
    const [linkPositions, setLinkPositions] = useState<LinkPosition[]>([]);
    const linkPositionsRef = useRef<LinkPosition[]>([]);
    
    const prevScrollChunkRef = useRef(0);
    const lastFrameRef = useRef<string[][]>([]);

    // Cursor references
    const cursorRef = useRef<{
        grid: { x: number; y: number };
        normalized: { x: number; y: number };
        isInWindow: boolean;
        isActive: boolean;
    }>({
        grid: { x: 0, y: 0 },
        normalized: { x: 0, y: 0 },
        isInWindow: false,
        isActive: false
    });
    
    const lastMouseMoveTime = useRef(0);
    const MOUSE_MOVE_THROTTLE = 16; // ~60fps

    // Touch gesture
    const touchStartY = useRef(0);
    const touchStartTime = useRef(0);
    const lastTouchY = useRef(0);
    const isTouching = useRef(false);

    // Blob cache
    const blobGridCache = useRef<{
        grid: {[key: string]: Uint8Array},
        startX: number,
        startY: number,
        width: number,
        height: number
    }>({
        grid: {},
        startX: 0,
        startY: 0,
        width: 0,
        height: 0
    });

    const spatialGridRef = useRef<{[key: string]: Array<{textKey: string, x: number, y: number}>}>({});
    const needsRebuildRef = useRef(true);
    const rebuildCacheTimeoutRef = useRef<number | null>(null);
    const scrollTimeoutRef = useRef<number | null>(null);

    // Content height and maxScroll
    const contentHeight = useMemo(() => {
        if (!textContent.length) return 0;
        let maxY = 0;
        textContent.forEach(item => {
            if (item.fixed) return;
            const lines = item.preRenderedAscii 
                ? item.preRenderedAscii.split('\n').length 
                : (item.text ? item.text.split('\n').length : 0);
            maxY = Math.max(maxY, item.y + lines);
        });
        return maxY * CHAR_HEIGHT + 50; // Some padding
    }, [textContent]);

    const maxScroll = useMemo(() => {
        if (!size.height) return 0;
        const effectiveMaxHeight = maxScrollHeight || contentHeight;
        return Math.max(0, effectiveMaxHeight - size.height);
    }, [size.height, contentHeight, maxScrollHeight]);

    const getGridDimensions = useCallback((width: number, height: number) => {
        const cols = Math.floor(width / CHAR_WIDTH);
        const rows = Math.floor(height / CHAR_HEIGHT);
        return { cols, rows };
    }, []);

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
        const positionGrid: { [key: string]: { char: string; fixed: boolean } } = {};
        const textBounds: {[key: string]: {minX: number, maxX: number, minY: number, maxY: number, fixed: boolean}} = {};
        const links: LinkPosition[] = [];
        
        const virtualAreaHeight = rows * 3;
        
        textContent.forEach(textItem => {
            const key = `${textItem.text}-${textItem.x}-${textItem.y}`;
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
            
            if (textItem.usePercentPosition !== false) {
                // Convert from percentage (0-100) to grid coordinates
                gridX = Math.floor((textItem.x / 100) * cols);
                gridY = Math.floor((textItem.y / 100) * rows);
            }
            
            // New approach - use renderFormattedText to handle all text types
            let textLines: string[];
            let linkData: Array<{line: number, start: number, end: number, url: string}> = [];
            
            if (textItem.preRenderedAscii) {
                // If there's pre-rendered ASCII art, use it
                textLines = textItem.preRenderedAscii.split('\n');
            } else {
                // Use the text renderer for all text types
                const fontName = textItem.fontName || 'regular';
                const formattedResult = renderFormattedText(textItem.text, fontName);
                textLines = formattedResult.text.split('\n');
                linkData = formattedResult.links;
            }
            
            if (!textLines || !textLines.length) return;
            
            let maxWidth = cols;
            if (textItem.maxWidthPercent && textItem.maxWidthPercent > 0 && textItem.maxWidthPercent <= 100) {
                maxWidth = Math.floor((cols * textItem.maxWidthPercent) / 100);
            }
            
            // Word-wrapping for regular text
            const wrappedLines: string[] = [];
            if (!textItem.preRenderedAscii && textItem.fontName === 'regular' && textItem.maxWidthPercent) {
                for (let lineIndex = 0; lineIndex < textLines.length; lineIndex++) {
                    let currentLine = textLines[lineIndex];
                    if (!currentLine) {
                        wrappedLines.push('');
                        continue;
                    }
                    if (currentLine.length <= maxWidth) {
                        wrappedLines.push(currentLine);
                        continue;
                    }
                    while (currentLine.length > 0) {
                        if (currentLine.length <= maxWidth) {
                            wrappedLines.push(currentLine);
                            break;
                        }
                        let breakPoint = maxWidth;
                        while (breakPoint > 0 && 
                               currentLine[breakPoint] !== ' ' && 
                               currentLine[breakPoint-1] !== ' ') {
                            breakPoint--;
                        }
                        if (breakPoint === 0) breakPoint = maxWidth;
                        
                        wrappedLines.push(currentLine.substring(0, breakPoint).trim());
                        currentLine = currentLine.substring(breakPoint).trim();
                    }
                }
            } else {
                wrappedLines.push(...textLines);
            }
            
            const processLines = textItem.maxWidthPercent && 
                                !textItem.preRenderedAscii && 
                                textItem.fontName === 'regular'
                ? wrappedLines 
                : textLines;
            
            // For regular text, add line spacing (for readability)
            const finalLines: string[] = [];
            for (let i = 0; i < processLines.length; i++) {
                finalLines.push(processLines[i]);
                // Add an empty line after each line for better spacing for regular text
                if (textItem.fontName === 'regular' && !textItem.preRenderedAscii) {
                    finalLines.push('');  // Extra line spacing
                }
            }
            
            let maxLineLength = 0;
            for (const line of finalLines) {
                maxLineLength = Math.max(maxLineLength, line.length);
            }
            
            // Process links data and store link positions
            for (const linkInfo of linkData) {
                const lineY = gridY + linkInfo.line;
                let textX = gridX;
                
                if (textItem.centered) {
                    textX = Math.floor(cols / 2);
                }
                if (textItem.alignment) {
                    textX = textX - Math.floor(maxLineLength / 2);
                    if (textItem.alignment === 'center') {
                        textX = Math.floor(gridX + (maxWidth - finalLines[linkInfo.line].length) / 2);
                    } else if (textItem.alignment === 'right') {
                        textX = gridX + maxWidth - finalLines[linkInfo.line].length;
                    }
                } else if (textItem.centered && !textItem.alignment) {
                    textX = textX - Math.floor(finalLines[linkInfo.line].length / 2);
                }
                
                links.push({
                    textKey: key,
                    url: linkInfo.url,
                    startX: textX + linkInfo.start,
                    endX: textX + linkInfo.end - 1,
                    y: lineY
                });
            }
            
            for (let lineIndex = 0; lineIndex < finalLines.length; lineIndex++) {
                let lineText = finalLines[lineIndex];
                if (!lineText) continue;
                
                if (lineText.length > maxWidth) {
                    lineText = lineText.substring(0, maxWidth);
                }
                
                const lineY = gridY + lineIndex;
                
                let textX = gridX;
                if (textItem.centered) {
                    textX = Math.floor(cols / 2);
                }
                if (textItem.alignment) {
                    textX = textX - Math.floor(maxLineLength / 2);
                    if (textItem.alignment === 'center') {
                        const lineOffset = Math.floor((maxLineLength - lineText.length) / 2);
                        textX = textX + lineOffset;
                    } else if (textItem.alignment === 'right') {
                        textX = textX + (maxLineLength - lineText.length);
                    }
                } else if (textItem.centered && !textItem.alignment) {
                    textX = textX - Math.floor(lineText.length / 2);
                }
                
                textBounds[key].minY = Math.min(textBounds[key].minY, lineY);
                textBounds[key].maxY = Math.max(textBounds[key].maxY, lineY);
                
                for (let charIndex = 0; charIndex < lineText.length; charIndex++) {
                    const x = textX + charIndex;
                    
                    if (x < -cols || x > cols * 2) continue;
                    
                    const char = lineText[charIndex];
                    if (char && char !== ' ') {
                        cache[key].push({
                            startX: x,
                            endX: x,
                            y: lineY,
                            char: char,
                            fixed: isFixed
                        });
                        
                        textBounds[key].minX = Math.min(textBounds[key].minX, x);
                        textBounds[key].maxX = Math.max(textBounds[key].maxX, x);
                        
                        if (isFixed || 
                            (lineY >= -virtualAreaHeight && lineY <= virtualAreaHeight * 2)) {
                            positionGrid[`${x},${lineY}`] = { char, fixed: isFixed };
                        }
                    }
                }
            }
            const padding = BLOB_PADDING;
            textBounds[key].minX = Math.max(-cols, textBounds[key].minX - padding);
            textBounds[key].maxX = Math.min(cols * 2, textBounds[key].maxX + padding);
            textBounds[key].minY = Math.max(-virtualAreaHeight, textBounds[key].minY - padding);
            textBounds[key].maxY = Math.min(virtualAreaHeight * 2, textBounds[key].maxY + padding);
        });
        
        // Update link positions ref
        linkPositionsRef.current = links;
        setLinkPositions(links);
        
        // Log link positions for debugging
        if (links.length > 0) {
            console.log(`Found ${links.length} clickable links:`, links);
        }
        
        return { cache, grid: positionGrid, bounds: textBounds, links };
    }, [textContent, asciiArtCache, size, getGridDimensions]);

    // Update the updateLinkOverlays function with more aggressive Safari adjustments
    const updateLinkOverlays = useCallback(() => {
        if (!size.width || !size.height) return;
        
        const scrolledY = Math.floor(scrollOffsetRef.current / CHAR_HEIGHT);
        const newOverlays: Array<{url: string; style: React.CSSProperties}> = [];
        
        for (const link of linkPositionsRef.current) {
            const isFixed = textPositionCache.bounds[link.textKey]?.fixed || false;
            const linkY = isFixed ? link.y : link.y - scrolledY;
            
            if (linkY >= -1 && linkY < (size.height / CHAR_HEIGHT) + 1) { // Expanded range to catch edge cases
                const left = link.startX * CHAR_WIDTH;
                const top = linkY * CHAR_HEIGHT;
                
                // Apply Safari offset
                const adjustedTop = top + SAFARI_LINK_Y_OFFSET;
                
                const width = (link.endX - link.startX + 1) * CHAR_WIDTH;
                // Make clickable area much taller to improve hit detection
                const height = IS_SAFARI ? CHAR_HEIGHT * 2 : CHAR_HEIGHT * 1.5;
                
                newOverlays.push({
                    url: link.url,
                    style: {
                        position: 'absolute',
                        left: `${left}px`,
                        top: `${adjustedTop}px`,
                        width: `${width}px`,
                        height: `${height}px`,
                        // Make overlays slightly visible for Safari for debugging purposes
                        backgroundColor: IS_SAFARI ? 'rgba(255, 0, 0, 0.1)' : 'transparent',
                        cursor: 'pointer',
                        zIndex: 1000,
                        // Enable pointer-events explicitly for Safari
                        pointerEvents: 'auto',
                        transition: 'background-color 0.2s ease-in-out',
                    }
                });
            }
        }
        
        setLinkOverlays(newOverlays);
    }, [size, textPositionCache.bounds]);

    // Precompute sin/cos tables
    const sinTable = useMemo(() => {
        const table = new Array(360);
        for (let i = 0; i < 360; i++) {
            table[i] = Math.sin((i * Math.PI) / 180);
        }
        return table;
    }, []);

    const cosTable = useMemo(() => {
        const table = new Array(360);
        for (let i = 0; i < 360; i++) {
            table[i] = Math.cos((i * Math.PI) / 180);
        }
        return table;
    }, []);

    const fastSin = useCallback((angle: number) => {
        const index = Math.floor(((angle % (2 * Math.PI)) / (2 * Math.PI)) * 360) % 360;
        return sinTable[index >= 0 ? index : index + 360];
    }, [sinTable]);

    const fastCos = useCallback((angle: number) => {
        const index = Math.floor(((angle % (2 * Math.PI)) / (2 * Math.PI)) * 360) % 360;
        return cosTable[index >= 0 ? index : index + 360];
    }, [cosTable]);

    // Build blob cache
    const buildBlobCache = useCallback(() => {
        if (!size.width || !size.height) return;
        
        const scrolledY = Math.floor(scrollOffsetRef.current / CHAR_HEIGHT);
        const { cols, rows } = getGridDimensions(size.width, size.height);
        
        const padding = BLOB_RADIUS * 3;
        const cacheStartX = -padding;
        const cacheStartY = scrolledY - rows - padding; 
        const cacheWidth = cols + padding * 2;
        const cacheHeight = rows * 4 + padding * 2;
        
        const gridWidth = Math.ceil(cacheWidth / BLOB_CACHE_GRID_SIZE);
        const gridHeight = Math.ceil(cacheHeight / BLOB_CACHE_GRID_SIZE);
        
        const newGrid: {[key: string]: Uint8Array} = {};
         
        const spatialGrid: {[key: string]: Array<{textKey: string, x: number, y: number}>} = {};
        const cellSize = GRID_CELL_SIZE * BLOB_RADIUS;
        
        for (const textKey in textPositionCache.cache) {
            const positions = textPositionCache.cache[textKey];
            const bounds = textPositionCache.bounds[textKey];
            const isFixed = bounds.fixed;
            
            for (const pos of positions) {
                const effectiveY = isFixed ? pos.y : pos.y;
                
                if (effectiveY < cacheStartY - BLOB_RADIUS || 
                    effectiveY > cacheStartY + cacheHeight + BLOB_RADIUS) {
                    continue;
                }
                if (pos.startX < cacheStartX - BLOB_RADIUS || 
                    pos.startX > cacheStartX + cacheWidth + BLOB_RADIUS) {
                    continue;
                }
                
                const gridX = Math.floor(pos.startX / cellSize);
                const gridY = Math.floor(effectiveY / cellSize);
                const cellKey = `${gridX},${gridY}`;
                
                if (!spatialGrid[cellKey]) spatialGrid[cellKey] = [];
                spatialGrid[cellKey].push({
                    textKey,
                    x: pos.startX,
                    y: effectiveY
                });
            }
        }
        
        for (let gy = 0; gy < gridHeight; gy++) {
            for (let gx = 0; gx < gridWidth; gx++) {
                const cellArray = new Uint8Array(BLOB_CACHE_GRID_SIZE * BLOB_CACHE_GRID_SIZE);
                newGrid[`${gx},${gy}`] = cellArray;
                
                const cellWorldX = cacheStartX + gx * BLOB_CACHE_GRID_SIZE;
                const cellWorldY = cacheStartY + gy * BLOB_CACHE_GRID_SIZE;
                
                const spatialCellsToCheck: string[] = [];
                const minSpatialX = Math.floor((cellWorldX - BLOB_RADIUS) / cellSize);
                const maxSpatialX = Math.floor((cellWorldX + BLOB_CACHE_GRID_SIZE + BLOB_RADIUS) / cellSize);
                const minSpatialY = Math.floor((cellWorldY - BLOB_RADIUS) / cellSize);
                const maxSpatialY = Math.floor((cellWorldY + BLOB_CACHE_GRID_SIZE + BLOB_RADIUS) / cellSize);
                
                for (let sy = minSpatialY; sy <= maxSpatialY; sy++) {
                    for (let sx = minSpatialX; sx <= maxSpatialX; sx++) {
                        const spatialKey = `${sx},${sy}`;
                        if (spatialGrid[spatialKey]) {
                            spatialCellsToCheck.push(spatialKey);
                        }
                    }
                }
                if (spatialCellsToCheck.length === 0) continue;
                
                for (let localY = 0; localY < BLOB_CACHE_GRID_SIZE; localY++) {
                    for (let localX = 0; localX < BLOB_CACHE_GRID_SIZE; localX++) {
                        const worldX = cellWorldX + localX;
                        const worldY = cellWorldY + localY;
                        const index = localY * BLOB_CACHE_GRID_SIZE + localX;
                        
                        let isInterior = false;
                        let isBorder = false;
                        
                        for (const spatialKey of spatialCellsToCheck) {
                            const positions = spatialGrid[spatialKey];
                            
                            for (const pos of positions) {
                                const dx = worldX - pos.x;
                                const dy = worldY - pos.y;
                                const distanceSquared = dx * dx + dy * dy * 2;
                                
                                if (distanceSquared < (BLOB_RADIUS - 2) * (BLOB_RADIUS - 2)) {
                                    isInterior = true;
                                    break;
                                }
                                if (distanceSquared < BLOB_RADIUS * BLOB_RADIUS) {
                                    isBorder = true;
                                }
                            }
                            if (isInterior) break;
                        }
                        cellArray[index] = isInterior ? 1 : (isBorder ? 2 : 0);
                    }
                }
            }
        }
        
        blobGridCache.current = {
            grid: newGrid,
            startX: cacheStartX,
            startY: cacheStartY,
            width: cacheWidth,
            height: cacheHeight
        };
        
        spatialGridRef.current = spatialGrid;
        needsRebuildRef.current = false;
    }, [size, textPositionCache, getGridDimensions]);

    // Calculate character for a single x,y
    const calculateCharacter = useCallback((x: number, y: number, cols: number, rows: number, aspect: number, time: number) => {
        const cursorState = cursorRef.current;
        const scrollY = scrollOffsetRef.current;
        
        if (x < HORIZONTAL_PADDING || x >= cols - HORIZONTAL_PADDING) {
            return ' ';
        }
        
        const scrolledY = Math.floor(scrollY / CHAR_HEIGHT);
        
        // Check for fixed elements first (elements that don't scroll)
        const gridKey = `${x},${y}`;
        const fixedChar = textPositionCache.grid[gridKey];
        if (fixedChar && fixedChar.fixed) return fixedChar.char;
        
        // Then check for scrollable text content
        const scrolledGridKey = `${x},${y + scrolledY}`;
        const scrolledChar = textPositionCache.grid[scrolledGridKey];
        if (scrolledChar && !scrolledChar.fixed) return scrolledChar.char;
        
        const timeFactor = time * 0.00003;
        
        // -- BLOB LOOKUP with improved coordinate consistency --
        const cache = blobGridCache.current;
        const localX = x - cache.startX;
        const localY = (y + scrolledY) - cache.startY;
        
        let cellValue = 0;
        if (localX >= 0 && localX < cache.width && localY >= 0 && localY < cache.height) {
            const gridX = Math.floor(localX / BLOB_CACHE_GRID_SIZE);
            const gridY = Math.floor(localY / BLOB_CACHE_GRID_SIZE);
            const cellKey = `${gridX},${gridY}`;
            
            if (cache.grid[cellKey]) {
                const localCellX = localX % BLOB_CACHE_GRID_SIZE;
                const localCellY = localY % BLOB_CACHE_GRID_SIZE;
                const index = localCellY * BLOB_CACHE_GRID_SIZE + localCellX;
                cellValue = cache.grid[cellKey][index];
            }
        }

        // -- If we are scrolling, we will still render the blob's border/interior,
        //    but with simplified animation to maintain performance
        if (cellValue === 1) {
            return ' '; // Interior always renders as space
        }
        
        // If border region, calculate border effects
        if (cellValue === 2) {
            // Border effect with faster calculation
            const borderEffect = (fastSin(x * BORDER_FREQUENCY + timeFactor * 80) * 
                                 fastCos(y * BORDER_FREQUENCY - timeFactor * 40)) * 0.25;
            
            // Simplified border check with higher probability of returning space
            if (borderEffect > -0.15) return ' ';
        }
        
        // ==========================================
        // BACKGROUND ANIMATION (never paused)
        // ==========================================
        const sizeVal = Math.min(cols, rows);
        const aspectRatio = aspect * 0.2;
        const position = {
            x: ((4 * (x - cols / 6.25)) / sizeVal) * aspectRatio,
            y: (5 * (y - rows / 4)) / sizeVal,
        };
        
        const mouseInfluence = Math.sqrt(
            Math.pow((x / cols) * 2 - 1 - cursorState.normalized.x, 2) + 
            Math.pow((y / rows) * 2 - 1 - cursorState.normalized.y, 2)
        );
        
        const cursorRadius = 0.3;
        const cursorIntensity = cursorState.isInWindow ? Math.max(0, 1 - (mouseInfluence / cursorRadius)) : 0;
        const cursorEffect = cursorIntensity * 0.8;
        
        const pulseRate = 1.;
        const pulseIntensity = 0.2;
        const pulse = Math.sin(time * 0.001 * pulseRate) * pulseIntensity + 1;
        
        const rippleSpeed = 1.2;
        const rippleFrequency = 5;
        const rippleDecay = 0.5;
        const ripple = Math.sin(mouseInfluence * rippleFrequency - time * 0.0005 * rippleSpeed) * 
                      Math.exp(-mouseInfluence * rippleDecay) * 
                      (cursorState.isInWindow ? 0.3 : 0);
        
        const wave1 = Math.sin(position.x * 1.5 + timeFactor + cursorState.normalized.x) * 
                      Math.cos(position.y * 1.5 - timeFactor + cursorState.normalized.y);
        const wave2 = Math.cos(position.x * position.y * 0.8 + timeFactor * 1.2);
        const spiral = Math.sin(Math.sqrt(position.x * position.x + position.y * position.y) * 3 - timeFactor * 1.5);
        const mouseRipple = Math.sin(mouseInfluence * 5 - timeFactor * 2) / (mouseInfluence + 1);
        
        let combined = (wave1 * 0.3 + wave2 * 0.2 + spiral * 0.2 + mouseRipple * 0.3 + 1) / 2;
        if (cursorState.isInWindow) {
            combined = Math.min(1, combined + cursorEffect * pulse + ripple);
            if (mouseInfluence < 0.05) {
                combined = 0.95;
            }
        }

        const index = Math.floor(combined * characterSetLength + (Math.floor(x + y) % 2));
        return selectedCharacterSet[index % characterSetLength];
    }, [
        textPositionCache, 
        fastSin, 
        fastCos, 
        blobGridCache
    ]);

    // Enhanced scrolling effect with speed detection
    useEffect(() => {
        let animationFrameId: number;
        
        const updateScroll = (timestamp: number) => {
            const elapsed = timestamp - lastScrollTime.current;
            lastScrollTime.current = timestamp;
            
            if (elapsed > 0) {
                if (!isScrolling.current && scrollVelocity.current !== 0) {
                    const friction = 0.95;
                    scrollVelocity.current *= Math.pow(friction, elapsed / 16);
                    
                    if (Math.abs(scrollVelocity.current) < 0.1) {
                        scrollVelocity.current = 0;
                    } else {
                        let newOffset = scrollOffsetRef.current + scrollVelocity.current;
                        newOffset = Math.max(0, Math.min(maxScroll, newOffset));
                        if (newOffset === 0 || newOffset === maxScroll) {
                            scrollVelocity.current = 0;
                        }
                        scrollOffsetRef.current = newOffset;
                        setScrollOffset(newOffset);
                        if (Math.abs(scrollVelocity.current) > 5) {
                            needsRebuildRef.current = true;
                        }
                    }
                }
            }
            animationFrameId = requestAnimationFrame(updateScroll);
        };
        
        animationFrameId = requestAnimationFrame(updateScroll);
        return () => cancelAnimationFrame(animationFrameId);
    }, [maxScroll]);

    // Wheel scroll
    useEffect(() => {
        if (!textRef.current) return;
        
        const handleWheel = (e: WheelEvent) => {
            // Don't prevent wheel events over links to allow normal browser behavior
            const target = e.target as HTMLElement;
            const linkElement = target.closest('a');
            if (linkElement && linkElement.getAttribute('href')) {
                return;
            }
            
            e.preventDefault();
            isScrolling.current = true;
            
            const scrollMultiplier = 1.0;
            let delta = e.deltaY * scrollMultiplier;
            
            let newScrollOffset = scrollOffsetRef.current + delta;
            newScrollOffset = Math.max(0, Math.min(maxScroll, newScrollOffset));
            
            scrollOffsetRef.current = newScrollOffset;
            requestAnimationFrame(() => {
                setScrollOffset(newScrollOffset);
                // Force update link overlays when scrolling
                updateLinkOverlays();
            });
            
            scrollVelocity.current = delta * 0.8;
            lastScrollTime.current = performance.now();
            
            if (Math.abs(delta) > 50) {
                needsRebuildRef.current = true;
            }
            
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
            }
            
            scrollTimeoutRef.current = setTimeout(() => {
                isScrolling.current = false;
            }, 150);
        };
        
        const element = textRef.current;
        element.addEventListener('wheel', handleWheel, { passive: false });
        
        return () => {
            element.removeEventListener('wheel', handleWheel);
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
            }
        };
    }, [maxScroll, size, updateLinkOverlays]);

    // Animation
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
                
                // Don't prevent default - allow the browser to handle the link normally
            }
        };
        
        element.addEventListener('click', handleLinkClick);

        const { cols, rows } = getGridDimensions(size.width, size.height);
        const aspectRatio = size.width / size.height;
        
        // Ensure lastFrameRef has enough rows allocated
        if (!lastFrameRef.current || lastFrameRef.current.length !== rows) {
            lastFrameRef.current = new Array(rows)
                .fill(null)
                .map(() => new Array(cols).fill(' '));
        }
        
        let animationFrameId: number;
        
        const BASE_CHUNK_SIZE = 15;
        const numChunks = Math.ceil(rows / BASE_CHUNK_SIZE);
        
        // We'll build rowBuffers as an array of string arrays
        const rowBuffers: string[][] = new Array(rows)
            .fill(null)
            .map(() => new Array(cols).fill(' '));
        
        // Create a map to track styled characters
        const styleMap: Map<string, string> = new Map();
        
        const animate = (timestamp: number) => {
            if (timestamp - lastFrameTimeRef.current >= FRAME_DURATION) {
                // Set quality based on scrolling state
                let skipFactor = 1;
                let chunkSizeFactor = 1;
                
                const isCompletelyStill = !isScrolling.current && Math.abs(scrollVelocity.current) < 0.05;
                
                if (!isCompletelyStill) {
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
                                styleMap.set(`${x},${linkY}`, `<a href="${link.url}" style="color:#3498db; text-decoration: underline; cursor: pointer;" data-link-url="${link.url}" class="ascii-link" target="_blank" onclick="window.open('${link.url}', '_blank')">$</a>`);
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
    }, [size, calculateCharacter, getGridDimensions]);

    // Rebuild blob cache during scrolling
    useEffect(() => {
        const SMALL_SCROLL_CHUNK_SIZE = CHAR_HEIGHT * 3;
        const scrollChunk = Math.floor(scrollOffset / SMALL_SCROLL_CHUNK_SIZE);
        
        scrollOffsetRef.current = scrollOffset;
        
        if (scrollChunk !== prevScrollChunkRef.current) {
            prevScrollChunkRef.current = scrollChunk;
            needsRebuildRef.current = true;
            
            if (rebuildCacheTimeoutRef.current) {
                clearTimeout(rebuildCacheTimeoutRef.current);
            }
            
            rebuildCacheTimeoutRef.current = setTimeout(() => {
                if (needsRebuildRef.current) {
                    buildBlobCache();
                }
            }, 100);
        }
    }, [scrollOffset, buildBlobCache]);

    // Mouse events - fix Safari cursor offset
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            const now = performance.now();
            if (now - lastMouseMoveTime.current < MOUSE_MOVE_THROTTLE) {
                return;
            }
            lastMouseMoveTime.current = now;
            
            if (!size.width || !size.height || !textRef.current) return;
            
            const rect = textRef.current.getBoundingClientRect();
            const relativeX = e.clientX - rect.left;
            const relativeY = e.clientY - rect.top + SAFARI_CURSOR_Y_OFFSET; // Apply Safari offset
            
            const gridX = Math.floor(relativeX / CHAR_WIDTH);
            const gridY = Math.floor(relativeY / CHAR_HEIGHT);
            
            const { cols, rows } = getGridDimensions(size.width || 0, size.height || 0);
            const normalizedX = (gridX / cols) * 2 - 1;
            const normalizedY = (gridY / rows) * 2 - 1;
            
            cursorRef.current = {
                grid: { x: gridX, y: gridY },
                normalized: { x: normalizedX, y: normalizedY },
                isInWindow: true,
                isActive: cursorRef.current.isActive
            };
        };

        const handleMouseLeave = () => {
            cursorRef.current = {
                ...cursorRef.current,
                isInWindow: false
            };
        };

        const handleMouseEnter = () => {
            cursorRef.current = {
                ...cursorRef.current,
                isInWindow: true
            };
        };
        
        const handleMouseDown = () => {
            cursorRef.current = {
                ...cursorRef.current,
                isActive: true
            };
        };
        
        const handleMouseUp = () => {
            cursorRef.current = {
                ...cursorRef.current,
                isActive: false
            };
        };
        
        window.addEventListener('mousemove', handleMouseMove, { passive: true });
        window.addEventListener('mouseenter', handleMouseEnter);
        window.addEventListener('mouseleave', handleMouseLeave);
        window.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mouseup', handleMouseUp);
        
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseenter', handleMouseEnter);
            window.removeEventListener('mouseleave', handleMouseLeave);
            window.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [size, getGridDimensions]);

    // Resize
    useEffect(() => {
        const handleResize = () => {
            const width = window.innerWidth;
            const height = window.innerHeight;
            setSize({ height, width });
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Build blob cache
    useEffect(() => {
        if (!Object.keys(blobGridCache.current.grid).length && size.width && size.height) {
            buildBlobCache();
        }
    }, [buildBlobCache, size]);

    // Rebuild cache when size changes
    useEffect(() => {
        if (size.width && size.height) {
            needsRebuildRef.current = true;
            buildBlobCache();
        }
    }, [size, buildBlobCache]);

    // Rebuild cache when textPositionCache changes
    useEffect(() => {
        if (Object.keys(textPositionCache.cache).length > 0) {
            needsRebuildRef.current = true;
            setTimeout(() => {
                if (needsRebuildRef.current) {
                    buildBlobCache();
                }
            }, 0);
        }
    }, [textPositionCache, buildBlobCache]);

    // Touch events for mobile
    useEffect(() => {
        if (!textRef.current) return;
        
        const handleTouchStart = (e: TouchEvent) => {
            if (e.touches.length === 1) {
                touchStartY.current = e.touches[0].clientY;
                lastTouchY.current = e.touches[0].clientY;
                touchStartTime.current = performance.now();
                isTouching.current = true;
                scrollVelocity.current = 0;
            }
        };
        
        const handleTouchMove = (e: TouchEvent) => {
            if (!isTouching.current || e.touches.length !== 1) return;
            e.preventDefault();
            isScrolling.current = true;
            
            const currentY = e.touches[0].clientY;
            const deltaY = lastTouchY.current - currentY;
            lastTouchY.current = currentY;
            
            let newScrollOffset = scrollOffsetRef.current + deltaY;
            const overscrollAmount = 100;
            newScrollOffset = Math.max(-overscrollAmount, Math.min(maxScroll + overscrollAmount, newScrollOffset));
            if (newScrollOffset < 0 || newScrollOffset > maxScroll) {
                newScrollOffset = scrollOffsetRef.current + deltaY * 0.3;
            }
            
            scrollOffsetRef.current = newScrollOffset;
            setScrollOffset(newScrollOffset);
        };
        
        const handleTouchEnd = (_: TouchEvent) => {
            if (!isTouching.current) return;
            isTouching.current = false;
            
            const touchEndTime = performance.now();
            const timeElapsed = touchEndTime - touchStartTime.current;
            
            if (timeElapsed < 300) {
                const distance = touchStartY.current - lastTouchY.current;
                const velocity = distance / timeElapsed * 15;
                scrollVelocity.current = velocity;
                lastScrollTime.current = touchEndTime;
            }
            
            if (scrollOffsetRef.current < 0) {
                scrollOffsetRef.current = 0;
                setScrollOffset(0);
                scrollVelocity.current = 0;
            } else if (scrollOffsetRef.current > maxScroll) {
                scrollOffsetRef.current = maxScroll;
                setScrollOffset(maxScroll);
                scrollVelocity.current = 0;
            }
            
            setTimeout(() => {
                isScrolling.current = false;
            }, 100);
        };
        
        const element = textRef.current;
        
        element.addEventListener('touchstart', handleTouchStart, { passive: true });
        element.addEventListener('touchmove', handleTouchMove, { passive: false });
        element.addEventListener('touchend', handleTouchEnd, { passive: true });
        element.addEventListener('touchcancel', handleTouchEnd, { passive: true });
        
        return () => {
            element.removeEventListener('touchstart', handleTouchStart);
            element.removeEventListener('touchmove', handleTouchMove);
            element.removeEventListener('touchend', handleTouchEnd);
            element.removeEventListener('touchcancel', handleTouchEnd);
        };
    }, [maxScroll]);

    // Clear blob cache on content changes
    useEffect(() => {
        blobGridCache.current = {
            grid: {},
            startX: 0,
            startY: 0,
            width: 0,
            height: 0
        };
    }, [textContent]);

    // Make sure the overlay hover styles are updated
    const handleClick = useCallback((e: MouseEvent) => {
        if (!textRef.current || !size.width || !size.height) return;
        
        // Check if the click was on an overlay element first (most reliable)
        const target = e.target as HTMLElement;
        if (target.closest('[data-link-overlay="true"]')) {
            // The click was handled by the overlay directly
            return;
        }
        
        // Check if the click was on an anchor element
        const closestAnchor = target.closest('a');
        if (closestAnchor) {
            // The click was directly on a link
            const href = closestAnchor.getAttribute('href');
            if (href) {
                console.log('Link clicked via handleClick:', href);
                window.open(href, '_blank');
                e.preventDefault();
                return;
            }
        }
        
        // Custom link detection for clicks not directly on anchors
        const rect = textRef.current.getBoundingClientRect();
        const relativeX = e.clientX - rect.left;
        const relativeY = e.clientY - rect.top + SAFARI_CURSOR_Y_OFFSET; // Apply same offset as cursor tracking
        
        const gridX = Math.floor(relativeX / CHAR_WIDTH);
        const gridY = Math.floor(relativeY / CHAR_HEIGHT);
        
        // Adjust for scroll position
        const scrolledY = Math.floor(scrollOffsetRef.current / CHAR_HEIGHT);
        const adjustedGridY = gridY + scrolledY;
        
        // Use a much more forgiving hit detection area for Safari
        const baseHitSlop = IS_SAFARI ? 2.0 : 1.0;
        
        // Check if click is on a link with more forgiving boundaries
        for (const link of linkPositionsRef.current) {
            const isFixed = textPositionCache.bounds[link.textKey]?.fixed || false;
            const linkY = isFixed ? link.y : link.y - scrolledY;
            
            // Use a larger hit detection range for Safari
            if (gridX >= link.startX - baseHitSlop && 
                gridX <= link.endX + baseHitSlop && 
                ((isFixed && Math.abs(adjustedGridY - link.y) <= baseHitSlop) || 
                (!isFixed && Math.abs(gridY - linkY) <= baseHitSlop))) {
                console.log('Link detected via coordinate check:', link.url);
                window.open(link.url, '_blank');
                e.preventDefault();
                return;
            }
        }
    }, [size, textPositionCache?.bounds]);

    // Add event listeners for links - fix event handler types
    useEffect(() => {
        const element = textRef.current;
        if (!element) return;
        
        // Use correct event type
        const clickHandler = (e: MouseEvent) => handleClick(e);
        element.addEventListener('click', clickHandler);
        
        // Update cursor style over links
        const handleMouseMove = (e: MouseEvent) => {
            if (!element || !size.width || !size.height) return;
            
            const rect = element.getBoundingClientRect();
            const relativeX = e.clientX - rect.left;
            const relativeY = e.clientY - rect.top + SAFARI_CURSOR_Y_OFFSET; // Apply Safari offset
            
            const gridX = Math.floor(relativeX / CHAR_WIDTH);
            const gridY = Math.floor(relativeY / CHAR_HEIGHT);
            
            // Adjust for scroll position
            const scrolledY = Math.floor(scrollOffsetRef.current / CHAR_HEIGHT);
            const adjustedGridY = gridY + scrolledY;
            
            // Check if mouse is over a link - use more forgiving hit test for Safari
            let isOverLink = false;
            const hitSlop = IS_SAFARI ? 1.5 : 0.5;
            
            for (const link of linkPositionsRef.current) {
                const isFixed = textPositionCache.bounds[link.textKey]?.fixed || false;
                const linkY = isFixed ? link.y : link.y - scrolledY;
                
                if (gridX >= link.startX - hitSlop && 
                    gridX <= link.endX + hitSlop && 
                    ((isFixed && Math.abs(adjustedGridY - link.y) <= hitSlop) || 
                     (!isFixed && Math.abs(gridY - linkY) <= hitSlop))) {
                    isOverLink = true;
                    break;
                }
            }
            
            element.style.cursor = isOverLink ? 'pointer' : (maxScroll > 0 ? 'ns-resize' : 'default');
        };
        
        element.addEventListener('mousemove', handleMouseMove);
        
        return () => {
            element.removeEventListener('click', clickHandler);
            element.removeEventListener('mousemove', handleMouseMove);
        };
    }, [handleClick, maxScroll, size]);

    // Update the useEffect that was added for link overlays
    useEffect(() => {
        updateLinkOverlays();
    }, [linkPositions, scrollOffset, updateLinkOverlays]);

    return (
        <div 
            ref={containerRef}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                margin: 0,
                padding: 0,
                overflow: 'hidden'
            }}
        >
            <pre
                ref={textRef}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    margin: 0,
                    padding: 0,
                    overflow: 'hidden',
                    whiteSpace: 'pre',
                    backgroundColor: 'white',
                    color: 'black',
                    fontSize: `${SCALE_FACTOR}px`,
                    lineHeight: `${SCALE_FACTOR}px`,
                    fontFamily: 'monospace',
                    letterSpacing: 0,
                    marginLeft: '-1px',
                    width: 'calc(100% + 2px)',
                    cursor: maxScroll > 0 ? 'ns-resize' : 'default',
                    transform: `translateY(0)`,
                    willChange: 'transform',
                    backfaceVisibility: 'hidden',
                    pointerEvents: 'auto',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    zIndex: 1
                }}
                dangerouslySetInnerHTML={{ __html: '' }}
            />
            
            {/* Overlay with clickable areas for links */}
            {linkOverlays.map((overlay, index) => (
                <div
                    key={`link-overlay-${index}`}
                    style={overlay.style}
                    data-link-overlay="true"
                    data-url={overlay.url}
                    onClick={() => {
                        console.log("Link overlay clicked:", overlay.url);
                        window.open(overlay.url, '_blank');
                    }}
                    onMouseOver={(e) => {
                        // Make hover effect more visible in Safari for debugging
                        e.currentTarget.style.backgroundColor = IS_SAFARI ? 
                            'rgba(255, 0, 0, 0.3)' : 'rgba(52, 152, 219, 0.3)';
                    }}
                    onMouseOut={(e) => {
                        // Reset to initial state on mouse out
                        e.currentTarget.style.backgroundColor = IS_SAFARI ? 
                            'rgba(255, 0, 0, 0.1)' : 'transparent';
                    }}
                    title={overlay.url}
                />
            ))}
        </div>
    );
};

export default AsciiArtGenerator;