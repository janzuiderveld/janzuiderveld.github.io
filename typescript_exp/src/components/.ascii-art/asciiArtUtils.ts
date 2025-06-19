import { FontName } from './ASCII_text_renderer';

// Constants
export const selectedCharacterSet = "$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/|()1{}[]?-_+~<>i!lI;:,^`'. ";
// export const selectedCharacterSet = "rjft/|()1{}[]?-_+~<>i!lI;:,^`'. ";
export const characterSetLength = selectedCharacterSet.length;
export const SCALE_FACTOR = 10;
export const FRAME_DURATION = 1000 / 60; // Target 60 FPS

export const BORDER_FREQUENCY = 0.05;  // Reduced for slower waves
export const HORIZONTAL_PADDING = 0;  // Changed to 0 to remove whitespace borders

export const CHAR_WIDTH = SCALE_FACTOR * 0.6;  // Adjust multiplier to match actual character width
export const CHAR_HEIGHT = SCALE_FACTOR;

export const BLOB_RADIUS = 12;  // Increased for larger blobs
export const BLOB_PADDING = 15; // Increased to accommodate larger blobs

export const GRID_CELL_SIZE = 4; // Cell size for spatial partitioning
export const BLOB_CACHE_GRID_SIZE = 4; // Size of cells in the blob cache grid

export const MOUSE_MOVE_THROTTLE = 16; // ~60fps

// Types & Interfaces
export interface AsciiArtGeneratorProps {
  textContent: Array<{
    text: string, 
    x: number, // Interpreted as percentage of page width (0-100)
    y: number, // Interpreted as percentage of page height (0-100)
    fontName?: FontName, // 'regular', 'ascii', or 'smallAscii'
    preRenderedAscii?: string,
    fixed?: boolean,
    maxWidthPercent?: number,
    alignment?: 'left' | 'center' | 'right',
    usePercentPosition?: boolean // Optional flag to support both positioning systems
  }>;
  maxScrollHeight?: number;
}

export interface TextPositionCache {
  [key: string]: {
    startX: number;
    endX: number;
    y: number;
    char: string;
    fixed: boolean;
  }[];
}

export interface LinkPosition {
  textKey: string;
  url: string;
  startX: number;
  endX: number;
  y: number;
}

export interface CursorState {
  grid: { x: number; y: number };
  normalized: { x: number; y: number };
  isInWindow: boolean;
  isActive: boolean;
}

export interface BlobGridCache {
  grid: {[key: string]: Uint8Array},
  startX: number,
  startY: number,
  width: number,
  height: number
}

// Utility Functions
export function getGridDimensions(width: number, height: number) {
  const cols = Math.floor(width / CHAR_WIDTH);
  const rows = Math.floor(height / CHAR_HEIGHT);
  return { cols, rows };
}

// Precompute sin/cos tables
export function createSinTable() {
  const table = new Array(360);
  for (let i = 0; i < 360; i++) {
    table[i] = Math.sin((i * Math.PI) / 180);
  }
  return table;
}

export function createCosTable() {
  const table = new Array(360);
  for (let i = 0; i < 360; i++) {
    table[i] = Math.cos((i * Math.PI) / 180);
  }
  return table;
}

export function fastSin(angle: number, sinTable: number[]) {
  const index = Math.floor(((angle % (2 * Math.PI)) / (2 * Math.PI)) * 360) % 360;
  return sinTable[index >= 0 ? index : index + 360];
}

export function fastCos(angle: number, cosTable: number[]) {
  const index = Math.floor(((angle % (2 * Math.PI)) / (2 * Math.PI)) * 360) % 360;
  return cosTable[index >= 0 ? index : index + 360];
}

// Character calculation function
export function calculateCharacter(
  x: number, 
  y: number, 
  cols: number, 
  rows: number, 
  aspect: number, 
  time: number,
  cursorState: CursorState,
  scrollY: number,
  textPositionCache: any,
  blobGridCache: BlobGridCache,
  sinTable: number[],
  cosTable: number[]
) {
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
  const cache = blobGridCache;
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
    const borderEffect = (fastSin(x * BORDER_FREQUENCY + timeFactor * 80, sinTable) * 
                         fastCos(y * BORDER_FREQUENCY - timeFactor * 40, cosTable)) * 0.25;
    
    // Adjustment to border check threshold for proper blob rendering
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
} 