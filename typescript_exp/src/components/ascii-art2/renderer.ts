import React from 'react';
import { 
  BLOB_CACHE_GRID_SIZE, 
  BORDER_FREQUENCY, 
  CHAR_HEIGHT, 
  HORIZONTAL_PADDING, 
  selectedCharacterSet, 
  characterSetLength
} from './constants';
import { 
  TextPositionCacheResult, 
  BlobGridCache,
  CursorState
} from './types';

export interface CharacterPrecomputation {
  cols: number;
  rows: number;
  aspect: number;
  normX: Float32Array;
  normY: Float32Array;
  posX: Float32Array;
  posY: Float32Array;
  sizeVal: number;
  aspectWave: number;
  posXScaled: Float32Array;
  posYScaled: Float32Array;
  posXWave2: Float32Array;
  posXSquared: Float32Array;
  posYSquared: Float32Array;
}

export interface CharacterFrameData {
  sinPosX: Float32Array;
  cosPosY: Float32Array;
  wave2Phase: number;
  spiralPhase: number;
  timeFactor: number;
  pulse: number;
  rippleBase: number;
}

// Precomputed values
const SPACE = ' ';
const SQRT_8 = Math.sqrt(8); // Precompute √(2²+2²)
const MAX_DISTANCE_MULT = SQRT_8 * 1.5; // Precompute the value used for maxDistance * 1.5
const UINT32_MAX = 0xffffffff;

const pseudoRandom = (x: number, y: number, seed: number): number => {
  let h = (seed | 0) + Math.imul(x + 0x9e3779b9, 0x85ebca6b) + Math.imul(y + 0x27d4eb2f, 0xc2b2ae35);
  h = (h ^ (h >>> 16)) >>> 0;
  h = Math.imul(h, 0x27d4eb2f) >>> 0;
  h = (h ^ (h >>> 15)) >>> 0;
  return h / UINT32_MAX;
};

// Link underline characters lookup (faster than multiple === checks)
const LINK_UNDERLINE_CHARS: { [key: string]: boolean } = {
  '_': true, '‾': true, '-': true, '⎯': true, '⎺': true, '⎻': true, '⎼': true, '⎽': true
};

// Add result cache to avoid recalculating the same character repeatedly during scrolling
// This acts as a frame-level cache with a smaller memory footprint than a full LRU cache
// Key format: "x:y:scrollY"
const resultCache: Map<number, string> = new Map();
const MAX_CACHE_SIZE = 10000; // Limit cache size to prevent memory issues

let cachedFrameSeed = Number.NaN;
let cachedCols = 0;
let cachedRows = 0;
let frameDataCache: CharacterFrameData | null = null;

// Clear the cache at the beginning of each frame
export const clearCharacterCache = () => {
  resultCache.clear();
  cachedFrameSeed = Number.NaN;
  cachedCols = 0;
  cachedRows = 0;
  frameDataCache = null;
};

const ensureFrameData = (
  frameSeed: number,
  precomputed: CharacterPrecomputation,
  time: number,
  cursorState: CursorState,
  fastSin: (angle: number) => number,
  fastCos: (angle: number) => number
): CharacterFrameData => {
  const { cols, rows, posXScaled, posYScaled } = precomputed;
  const needsNewArrays = !frameDataCache || frameDataCache.sinPosX.length !== cols || frameDataCache.cosPosY.length !== rows;
  const needsRecompute = needsNewArrays || frameSeed !== cachedFrameSeed || cachedCols !== cols || cachedRows !== rows;

  if (!frameDataCache || needsNewArrays) {
    frameDataCache = {
      sinPosX: new Float32Array(cols),
      cosPosY: new Float32Array(rows),
      wave2Phase: 0,
      spiralPhase: 0,
      timeFactor: 0,
      pulse: 0,
      rippleBase: 0
    };
  }

  if (needsRecompute && frameDataCache) {
    const { sinPosX, cosPosY } = frameDataCache;
    const timeFactor = time * 0.00003;
    const wave2Phase = timeFactor * 1.2;
    const spiralPhase = timeFactor * 1.5;
    const rippleBase = time * 0.0005;
    const pulse = fastSin(time * 0.001) * 0.2 + 1;
    const offsetX = timeFactor + cursorState.normalized.x;
    const offsetY = -timeFactor + cursorState.normalized.y;

    for (let x = 0; x < cols; x++) {
      sinPosX[x] = fastSin(posXScaled[x] + offsetX);
    }

    for (let y = 0; y < rows; y++) {
      cosPosY[y] = fastCos(posYScaled[y] + offsetY);
    }

    frameDataCache.wave2Phase = wave2Phase;
    frameDataCache.spiralPhase = spiralPhase;
    frameDataCache.timeFactor = timeFactor;
    frameDataCache.pulse = pulse;
    frameDataCache.rippleBase = rippleBase;

    cachedFrameSeed = frameSeed;
    cachedCols = cols;
    cachedRows = rows;
  }

  return frameDataCache!;
};

const encodeCacheKey = (x: number, y: number, scrolledY: number): number => {
  return ((scrolledY & 0xfff) << 24) | ((y & 0xfff) << 12) | (x & 0xfff);
};

export const calculateCharacter = (
  x: number,
  y: number,
  cols: number,
  rows: number,
  aspect: number,
  time: number,
  textPositionCache: TextPositionCacheResult,
  blobGridCache: BlobGridCache,
  cursorRef: React.MutableRefObject<CursorState>,
  scrollY: number,
  fastSin: (angle: number) => number,
  fastCos: (angle: number) => number,
  precomputed?: CharacterPrecomputation | null,
  frameSeed?: number,
  frameNow?: number
): string => {
  const scrolledY = Math.floor(scrollY / CHAR_HEIGHT);

  // Check cache first - use x, y, and scrolledY as the cache key
  const cacheKey = encodeCacheKey(x, y, scrolledY);
  const cachedResult = resultCache.get(cacheKey);
  if (cachedResult) {
    return cachedResult;
  }

  // Local variables for frequent access (avoid object property lookups)
  const cursorState = cursorRef.current;
  const textGrid = textPositionCache.grid;
  const textGridCols = textPositionCache.gridCols;
  const textOffsetY = textPositionCache.offsetY;
  const cache = blobGridCache;
  const cacheGridWidth = cache.cacheGridWidth;
  const safeCols = cols || 1;
  const safeRows = rows || 1;
  const precomputedData = precomputed && precomputed.cols === cols && precomputed.rows === rows ? precomputed : null;
  const aspectWave = precomputedData ? precomputedData.aspectWave : aspect * 0.2;
  const sizeVal = precomputedData ? precomputedData.sizeVal : Math.max(1, Math.min(safeCols, safeRows));
  const normX = precomputedData ? precomputedData.normX[x] : (x / safeCols) * 2 - 1;
  const normY = precomputedData ? precomputedData.normY[y] : (y / safeRows) * 2 - 1;
  const posXValue = precomputedData ? precomputedData.posX[x] : ((4 * (x - cols / 6.25)) / sizeVal) * aspectWave;
  const posYValue = precomputedData ? precomputedData.posY[y] : (5 * (y - rows / 4)) / sizeVal;
  const frameData = precomputedData && typeof frameSeed === 'number'
    ? ensureFrameData(frameSeed, precomputedData, time, cursorState, fastSin, fastCos)
    : null;
  const seed = (frameSeed ?? Math.floor(time)) | 0;
  const currentTime = frameNow ?? Date.now();
  const randomValue = (offset: number) => pseudoRandom(x + offset, y - offset, seed ^ offset);
  const timeFactor = frameData?.timeFactor ?? time * 0.00003;
  
  // EARLY EXIT 1: Check for white overlay (fastest path)
  if (cursorState.whiteOverlay?.active) {
    resultCache.set(cacheKey, SPACE);
    return SPACE;
  }
  
  // EARLY EXIT 2: Check for white-in and white-out effects BEFORE checking for text
  // This ensures text characters are properly hidden during transitions
  
  // SPECIAL EFFECTS: White-in effect
  if (cursorState.whiteIn?.active) {
    const whiteIn = cursorState.whiteIn;
    
    // Normalize position once (reused for distance calculation)
    // Calculate squared distance from white-in center (avoid sqrt)
    const distX = normX - whiteIn.position.x;
    const distY = normY - whiteIn.position.y;
    const distanceSquared = distX * distX + distY * distY;
    
    // Calculate the squared radius of the current white-in circle
    const whiteInRadius = whiteIn.progress * MAX_DISTANCE_MULT;
    const radiusSquared = whiteInRadius * whiteInRadius;
    
    // If within radius, return space (using squared comparison to avoid sqrt)
    if (distanceSquared <= radiusSquared) {
      resultCache.set(cacheKey, SPACE);
      return SPACE;
    }
    
    // Edge dissolve effect (only compute this if we're not already returning a space)
    const distance = Math.sqrt(distanceSquared); // Only calculate sqrt when needed
    const edgeWidth = 0.1 + whiteIn.progress * 0.2;
    const edgeDistance = Math.abs(distance - whiteInRadius);
    
    // Optimize the edge dissolve randomization
    if (edgeDistance < edgeWidth) {
      const noiseThreshold = edgeDistance / edgeWidth * 0.8;
      // Use a faster method than Math.random for performance-critical code
      if (randomValue(17) > noiseThreshold) {
        resultCache.set(cacheKey, SPACE);
        return SPACE;
      }
    }
    
    // Random space effect - use cached progress calculation
    const progressEffect = whiteIn.progress * 0.4;
    if (randomValue(23) < progressEffect) {
      resultCache.set(cacheKey, SPACE);
      return SPACE;
    }
  }
  
  // SPECIAL EFFECTS: Whiteout effect
  if (cursorState.whiteout?.active) {
    const whiteout = cursorState.whiteout;
    
    // Normalize position once (reused for distance calculation)
    // Calculate squared distance from whiteout center (avoid sqrt)
    const distX = normX - whiteout.position.x;
    const distY = normY - whiteout.position.y;
    const distanceSquared = distX * distX + distY * distY;
    
    // Calculate the squared radius of the current whiteout circle
    const whiteoutRadius = whiteout.progress * MAX_DISTANCE_MULT;
    const radiusSquared = whiteoutRadius * whiteoutRadius;
    
    // If within radius, return space (using squared comparison to avoid sqrt)
    if (distanceSquared <= radiusSquared) {
      resultCache.set(cacheKey, SPACE);
      return SPACE;
    }
    
    // Edge dissolve effect (only compute this if we're not already returning a space)
    const distance = Math.sqrt(distanceSquared); // Only calculate sqrt when needed
    const edgeWidth = 0.1 + whiteout.progress * 0.2;
    const edgeDistance = Math.abs(distance - whiteoutRadius);
    
    // Optimize the edge dissolve randomization
    if (edgeDistance < edgeWidth) {
      const noiseThreshold = edgeDistance / edgeWidth * 0.8;
      // Use a faster method than Math.random for performance-critical code
      if (randomValue(31) > noiseThreshold) {
        resultCache.set(cacheKey, SPACE);
        return SPACE;
      }
    }
    
    // Random space effect - use cached progress calculation
    const progressEffect = whiteout.progress * 0.2;
    if (randomValue(41) < progressEffect) {
      resultCache.set(cacheKey, SPACE);
      return SPACE;
    }
    
    // Immediate replacement of link underlines (check after radius checks for performance)
    // Only check for link characters if we're in a whiteout and didn't already return a space
    const fixedY = y - textOffsetY;
    const fixedIndex = fixedY * textGridCols + x;
    const fixedChar = textGrid[fixedIndex];
    
    if (fixedChar?.fixed) {
      // Check if it might be a link (underscore is often part of link underlines)
      if (LINK_UNDERLINE_CHARS[fixedChar.char]) {
        resultCache.set(cacheKey, SPACE);
        return SPACE;
      }
    }
    
    const scrolledGridY = y + scrolledY - textOffsetY;
    const scrolledIndex = scrolledGridY * textGridCols + x;
    const scrolledChar = (x >= 0 && x < textGridCols && scrolledGridY >= 0 && scrolledIndex >= 0 && scrolledIndex < textGrid.length) ? textGrid[scrolledIndex] : null;
    
    if (scrolledChar && !scrolledChar.fixed) {
      // Check if it might be a link (underscore is often part of link underlines)
      if (LINK_UNDERLINE_CHARS[scrolledChar.char]) {
        resultCache.set(cacheKey, SPACE);
        return SPACE;
      }
    }
  }
  
  // EARLY EXIT 3: Create fast path for common case - check for text content
  const fixedY = y - textOffsetY;
  const fixedIndex = fixedY * textGridCols + x;
  const fixedChar = textGrid[fixedIndex];
  
  // If we found a fixed character, return it immediately (common case)
  if (fixedChar?.fixed) {
    resultCache.set(cacheKey, fixedChar.char);
    return fixedChar.char;
  }
  
  // Try to find scrolled character
  const scrolledGridY = y + scrolledY - textOffsetY;
  const scrolledIndex = scrolledGridY * textGridCols + x;
  // Check bounds before accessing grid (check x and calculated scrolledGridY)
  const scrolledChar = (x >= 0 && x < textGridCols && scrolledGridY >= 0 && scrolledIndex >= 0 && scrolledIndex < textGrid.length) ? textGrid[scrolledIndex] : null;
  
  // Return non-fixed character if found (also common case)
  if (scrolledChar && !scrolledChar.fixed) {
    resultCache.set(cacheKey, scrolledChar.char);
    return scrolledChar.char;
  }
  
  // EARLY EXIT 4: Quick horizontal padding check
  // Only do this after checking for text content to allow overflow for pre-rendered ASCII art
  const isInHorizontalPadding = x < HORIZONTAL_PADDING || x >= cols - HORIZONTAL_PADDING;
  if (isInHorizontalPadding && !fixedChar && !scrolledChar) {
    resultCache.set(cacheKey, SPACE);
    return SPACE;
  }

  // -- BLOB LOOKUP with coordinate caching --
  const localX = x - cache.startX;
  const localYFixed = y - cache.startY;
  const localYScrolled = y + scrolledY - cache.startY;
  
  // Cache boundary checks
  let cellValue = 0;
  
  // Important: Only check for fixed blobs if we have a fixed character
  // or for scrolled blobs if we have a scrolled character
  // This prevents duplicate blobs from appearing during scrolling
  
  // If we have a fixed character at this position, check for fixed blobs
  if (fixedChar?.fixed) {
    if (localX >= 0 && localX < cache.width && localYFixed >= 0 && localYFixed < cache.height) {
      // Use bitwise operations for integer division and modulo
      const gridX = (localX / BLOB_CACHE_GRID_SIZE) | 0;
      const gridY = (localYFixed / BLOB_CACHE_GRID_SIZE) | 0;
      const cellIndex = gridY * cacheGridWidth + gridX;
      const cellGrid = cellIndex >= 0 && cellIndex < cache.grid.length ? cache.grid[cellIndex] : null;
      
      if (cellGrid) {
        const localCellX = localX % BLOB_CACHE_GRID_SIZE;
        const localCellY = localYFixed % BLOB_CACHE_GRID_SIZE;
        const index = localCellY * BLOB_CACHE_GRID_SIZE + localCellX;
        cellValue = cellGrid[index];
      }
    }
  }
  // If we have a scrolled character at this position, check for scrolled blobs
  else if (scrolledChar && !scrolledChar.fixed) {
    if (localX >= 0 && localX < cache.width && localYScrolled >= 0 && localYScrolled < cache.height) {
      // Use bitwise operations for integer division and modulo
      const gridX = (localX / BLOB_CACHE_GRID_SIZE) | 0;
      const gridY = (localYScrolled / BLOB_CACHE_GRID_SIZE) | 0;
      const cellIndex = gridY * cacheGridWidth + gridX;
      const cellGrid = cellIndex >= 0 && cellIndex < cache.grid.length ? cache.grid[cellIndex] : null;
      
      if (cellGrid) {
        const localCellX = localX % BLOB_CACHE_GRID_SIZE;
        const localCellY = localYScrolled % BLOB_CACHE_GRID_SIZE;
        const index = localCellY * BLOB_CACHE_GRID_SIZE + localCellX;
        cellValue = cellGrid[index];
      }
    }
  }
  // FIX: Only check for background blobs in a single location, not both fixed and scrolled
  // This prevents the duplicated blob effect during scrolling
  else {
    // Only check for blobs in the fixed position
    // This ensures that blobs without text won't appear to move in counter-direction
    if (localX >= 0 && localX < cache.width && localYFixed >= 0 && localYFixed < cache.height) {
      const gridX = (localX / BLOB_CACHE_GRID_SIZE) | 0;
      const gridY = (localYFixed / BLOB_CACHE_GRID_SIZE) | 0;
      const cellIndex = gridY * cacheGridWidth + gridX;
      const cellGrid = cellIndex >= 0 && cellIndex < cache.grid.length ? cache.grid[cellIndex] : null;
      
      if (cellGrid) {
        const localCellX = localX % BLOB_CACHE_GRID_SIZE;
        const localCellY = localYFixed % BLOB_CACHE_GRID_SIZE;
        const index = localCellY * BLOB_CACHE_GRID_SIZE + localCellX;
        cellValue = cellGrid[index];
      }
    }
  }
  
  // Interior of blob always renders as space - quick check
  if (cellValue === 1) {
    resultCache.set(cacheKey, SPACE);
    return SPACE;
  }
  
  // If border region, calculate border effects - using cached values
  if (cellValue === 2) {
    // Precalculate time factors
    const xFrequency = x * BORDER_FREQUENCY;
    const yFrequency = y * BORDER_FREQUENCY;
    
    // Border effect with faster calculation
    const borderEffect = fastSin(xFrequency + timeFactor * 80) * 
                          fastCos(yFrequency - timeFactor * 40) * 0.25;
    
    // Simplified border check
    if (borderEffect > -0.15) {
      resultCache.set(cacheKey, SPACE);
      return SPACE;
    }
  }
  
  // BACKGROUND ANIMATION - only compute if we haven't already determined the character
  const normMouseX = cursorState.normalized.x;
  const normMouseY = cursorState.normalized.y;
  const isInWindow = cursorState.isInWindow;
  
  // Calculate mouse influence (squared distance, avoid sqrt when possible)
  const mouseDistX = normX - normMouseX;
  const mouseDistY = normY - normMouseY;
  const mouseDistSquared = mouseDistX * mouseDistX + mouseDistY * mouseDistY;
  let mouseInfluence = 0; // Calculated later if needed
  
  // Calculate background waves
  const posX = posXValue;
  const posY = posYValue;
  
  // Cursor effect - only calculate if mouse is in window
  let cursorEffect = 0;
  const cursorRadius = 0.3;
  const cursorRadiusSquared = cursorRadius * cursorRadius; // Precompute squared radius
  if (isInWindow) {
    // Use squared distance for comparison
    const cursorIntensity = Math.max(0, 1 - Math.sqrt(mouseDistSquared / cursorRadiusSquared)); // Keep sqrt for linear falloff or use squared? Let's try sqrt for now for smoother falloff visually. Re-evaluate if needed.
    cursorEffect = cursorIntensity * 0.8;
  }
  
  const pulse = frameData?.pulse ?? (fastSin(time * 0.001) * 0.2 + 1);
  
  // Calculate actual mouseInfluence only if needed for ripples
  if (isInWindow) {
    mouseInfluence = Math.sqrt(mouseDistSquared); 
  }
  
  const rippleSpeed = 1.2;
  const rippleFrequency = 5;
  const rippleDecay = 0.5;
  let ripple = 0;
  if (isInWindow) {
    // Approximation for Math.exp(-mouseInfluence * rippleDecay)
    const rippleFalloff = Math.max(0, 1 - mouseInfluence * rippleDecay); // Linear falloff approximation
    const rippleBase = (frameData?.rippleBase ?? time * 0.0005) * rippleSpeed;
    ripple = fastSin(mouseInfluence * rippleFrequency - rippleBase) * 
             rippleFalloff * 0.3;
  }
  
  // Click ripples effect - only calculate if there are active ripples
  let clickRipplesEffect = 0;
  const clickRipples = cursorState.clickRipples;
  
  // Fast path for no ripples
  if (clickRipples?.length > 0) {
    for (const clickRipple of clickRipples) {
      const age = currentTime - clickRipple.timestamp;
      if (age >= clickRipple.lifespan) continue;
      
      // Calculate normalized age (0 to 1)
      const normalizedAge = age / clickRipple.lifespan;
      
      // Calculate distance from click point
      const clickDistX = normX - clickRipple.position.x;
      const clickDistY = normY - clickRipple.position.y;
      const clickDistSquared = clickDistX * clickDistX + clickDistY * clickDistY;
      let clickDistance = 0; // Calculate only if needed later
      
      // Ripple speed and size factors
      const rippleMaxSize = 2.0 + (clickRipple.intensity - 0.5) * 0.6;
      const rippleSize = normalizedAge * rippleMaxSize;
      
      // Intensity calculations - using attenuationFactor directly
      const ageAttenuationFactor = (1 - normalizedAge); // Simpler linear decay
      
      const rippleWidth = 0.05 + 0.1 * normalizedAge + (clickRipple.intensity - 0.5) * 0.05;
      const rippleWidthSquared = rippleWidth * rippleWidth; // Calculate squared width
      const distanceFromRippleEdge = Math.abs(clickDistance - rippleSize); // Needs clickDistance if used
      const distToEdgeSquared = distanceFromRippleEdge * distanceFromRippleEdge;
      
      // Approximation for Math.exp(-distToEdgeSquared / rippleWidthSquared)
      // Calculate ratio first, ensure width isn't zero
      const falloffRatio = rippleWidthSquared > 1e-6 ? distToEdgeSquared / rippleWidthSquared : 0;
      let ringEffect = Math.max(0, 1 - falloffRatio); // Approximate exp falloff
      // ringEffect needs clickDistance calculation. Let's rethink the approximation.
      // Can we approximate using clickDistSquared directly?
      // Let's try approximating the gaussian bell curve shape differently.
      // Maybe use the squared distance directly in the linear approximation?
      // ringEffect = Math.max(0, 1 - Math.abs(clickDistSquared - rippleSize * rippleSize) / (rippleWidthSquared * 5)); // Needs tuning factor? Let's try the original approach but ensure clickDistance is calculated first.
      
      // Calculate clickDistance NOW if needed for ringEffect or wavePattern
      clickDistance = Math.sqrt(clickDistSquared);
      const actualDistanceFromRippleEdge = Math.abs(clickDistance - rippleSize);
      const actualDistToEdgeSquared = actualDistanceFromRippleEdge * actualDistanceFromRippleEdge;
      const actualFalloffRatio = rippleWidthSquared > 1e-6 ? actualDistToEdgeSquared / rippleWidthSquared : 0;
      ringEffect = Math.max(0, 1 - actualFalloffRatio); // Use linear falloff with actual distance
      
      // Wave pattern
      const wavePatternIntensity = 0.1 + (clickRipple.intensity - 0.5) * 0.15;
      const wavePattern = fastSin(clickDistance * 20 - normalizedAge * 30 * clickRipple.speedFactor) * wavePatternIntensity; // Needs clickDistance
      
      // Calculate ripple intensity
      let rippleIntensity = clickRipple.intensity * ageAttenuationFactor * ringEffect * (0.9 + wavePattern);
      
      // High-intensity ripples (only calculate when needed)
      if (clickRipple.intensity > 0.8) {
        const secondaryRippleSize = rippleSize * 0.4;
        const secondaryDistanceFromEdge = Math.abs(clickDistance - secondaryRippleSize);
        const secondaryDistSquared = secondaryDistanceFromEdge * secondaryDistanceFromEdge; // Use actual distance
        const secondaryWidth = rippleWidth * 0.6;
        const secondaryWidthSquared = secondaryWidth * secondaryWidth; // Define before use
        // Approximation for Math.exp(-secondaryDistSquared / secondaryWidthSquared)
        const secondaryFalloffRatio = secondaryWidthSquared > 1e-6 ? secondaryDistSquared / secondaryWidthSquared : 0;
        const secondaryRingEffect = Math.max(0, 1 - secondaryFalloffRatio); // Linear falloff approximation
        
        rippleIntensity += rippleIntensity * 0.7 * secondaryRingEffect;
      }
      
      clickRipplesEffect += rippleIntensity;
    }
    
    // Clamp without Math.min for slight performance boost
    clickRipplesEffect = clickRipplesEffect > 1.0 ? 1.0 : clickRipplesEffect;
  }
  
  // Calculate wave patterns
  const wave1 = frameData 
    ? frameData.sinPosX[x] * frameData.cosPosY[y]
    : fastSin(posX * 1.5 + timeFactor + normMouseX) * fastCos(posY * 1.5 - timeFactor + normMouseY);

  const wave2Base = precomputedData
    ? precomputedData.posXWave2[x] * posY + (frameData?.wave2Phase ?? timeFactor * 1.2)
    : posX * posY * 0.8 + timeFactor * 1.2;
  const wave2 = fastCos(wave2Base);

  const spiralMagnitude = precomputedData
    ? Math.sqrt(precomputedData.posXSquared[x] + precomputedData.posYSquared[y]) * 3
    : Math.sqrt(posX * posX + posY * posY) * 3;
  const spiral = fastSin(spiralMagnitude - (frameData?.spiralPhase ?? timeFactor * 1.5));
  let mouseRipple = 0;
  if (isInWindow && mouseInfluence > 1e-6) { // Avoid division by zero/small number if mouseInfluence is 0
    mouseRipple = fastSin(mouseInfluence * 5 - timeFactor * 2) / (mouseInfluence + 1);
  }
  
  // Combined effects
  let combined = (wave1 * 0.3 + wave2 * 0.2 + spiral * 0.2 + mouseRipple * 0.3 + 1) / 2;
  
  // Only apply cursor effects if in window (avoid unnecessary calculations)
  if (isInWindow) {
    if (mouseInfluence < 0.05) {
      combined = 0.95;
    } else {
      // Avoid Math.min for small performance gain
      const effectSum = combined + cursorEffect * pulse + ripple + clickRipplesEffect;
      combined = effectSum > 1 ? 1 : effectSum;
    }
  }

  // Use bitwise OR for faster integer conversion
  const index = (combined * characterSetLength + ((x + y) & 1)) | 0;
  const result = selectedCharacterSet[index % characterSetLength];
  
  // Add to cache before returning
  if (resultCache.size >= MAX_CACHE_SIZE) {
    // Clear oldest entries if cache is full
    const keysToDelete = Array.from(resultCache.keys()).slice(0, 1000);
    keysToDelete.forEach(key => resultCache.delete(key));
  }
  resultCache.set(cacheKey, result);
  return result;
}; 
