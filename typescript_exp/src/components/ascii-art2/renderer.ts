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

// Precomputed values
const SPACE = ' ';
const SQRT_8 = Math.sqrt(8); // Precompute √(2²+2²)
const MAX_DISTANCE_MULT = SQRT_8 * 1.5; // Precompute the value used for maxDistance * 1.5

// Link underline characters lookup (faster than multiple === checks)
const LINK_UNDERLINE_CHARS: { [key: string]: boolean } = {
  '_': true, '‾': true, '-': true, '⎯': true, '⎺': true, '⎻': true, '⎼': true, '⎽': true
};

// Add result cache to avoid recalculating the same character repeatedly during scrolling
// This acts as a frame-level cache with a smaller memory footprint than a full LRU cache
// Key format: "x:y:scrollY"
const resultCache: Map<string, string> = new Map();
const MAX_CACHE_SIZE = 10000; // Limit cache size to prevent memory issues

// Clear the cache at the beginning of each frame
export const clearCharacterCache = () => {
  resultCache.clear();
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
  fastCos: (angle: number) => number
): string => {
  // Check cache first - use x, y, and scrollY as the cache key
  // Using scrollY ensures we don't keep stale results when scrolling
  const cacheKey = `${x}:${y}:${scrollY}`;
  const cachedResult = resultCache.get(cacheKey);
  if (cachedResult) {
    return cachedResult;
  }

  // Local variables for frequent access (avoid object property lookups)
  const cursorState = cursorRef.current;
  const scrolledY = Math.floor(scrollY / CHAR_HEIGHT);
  const textGrid = textPositionCache.grid;
  const textGridCols = textPositionCache.gridCols;
  const textOffsetY = textPositionCache.offsetY;
  const cache = blobGridCache;
  const cacheGridWidth = cache.cacheGridWidth;
  
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
    const normX = (x / cols) * 2 - 1;
    const normY = (y / rows) * 2 - 1;
    
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
      if ((Math.random() + Math.random() + Math.random()) / 3 > noiseThreshold) {
        resultCache.set(cacheKey, SPACE);
        return SPACE;
      }
    }
    
    // Random space effect - use cached progress calculation
    const progressEffect = whiteIn.progress * 0.4;
    if (Math.random() < progressEffect) {
      resultCache.set(cacheKey, SPACE);
      return SPACE;
    }
  }
  
  // SPECIAL EFFECTS: Whiteout effect
  if (cursorState.whiteout?.active) {
    const whiteout = cursorState.whiteout;
    
    // Normalize position once (reused for distance calculation)
    const normX = (x / cols) * 2 - 1;
    const normY = (y / rows) * 2 - 1;
    
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
      if ((Math.random() + Math.random()) / 2 > noiseThreshold) {
        resultCache.set(cacheKey, SPACE);
        return SPACE;
      }
    }
    
    // Random space effect - use cached progress calculation
    const progressEffect = whiteout.progress * 0.2;
    if (Math.random() < progressEffect) {
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
    const timeFactor = time * 0.00003;
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
  const timeFactor = time * 0.00003;
  const normMouseX = cursorState.normalized.x;
  const normMouseY = cursorState.normalized.y;
  const isInWindow = cursorState.isInWindow;
  
  // Precompute normalized positions
  const normX = (x / cols) * 2 - 1;
  const normY = (y / rows) * 2 - 1;
  
  // Calculate mouse influence (squared distance, avoid sqrt when possible)
  const mouseDistX = normX - normMouseX;
  const mouseDistY = normY - normMouseY;
  const mouseDistSquared = mouseDistX * mouseDistX + mouseDistY * mouseDistY;
  let mouseInfluence = 0; // Calculated later if needed
  
  // Calculate background waves
  const sizeVal = Math.min(cols, rows);
  const aspectRatio = aspect * 0.2;
  const posX = ((4 * (x - cols / 6.25)) / sizeVal) * aspectRatio;
  const posY = (5 * (y - rows / 4)) / sizeVal;
  
  // Cursor effect - only calculate if mouse is in window
  let cursorEffect = 0;
  const cursorRadius = 0.3;
  const cursorRadiusSquared = cursorRadius * cursorRadius; // Precompute squared radius
  if (isInWindow) {
    // Use squared distance for comparison
    const cursorIntensity = Math.max(0, 1 - Math.sqrt(mouseDistSquared / cursorRadiusSquared)); // Keep sqrt for linear falloff or use squared? Let's try sqrt for now for smoother falloff visually. Re-evaluate if needed.
    cursorEffect = cursorIntensity * 0.8;
  }
  
  const pulseRate = 1.0;
  const pulseIntensity = 0.2;
  const pulse = fastSin(time * 0.001 * pulseRate) * pulseIntensity + 1;
  
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
    ripple = fastSin(mouseInfluence * rippleFrequency - time * 0.0005 * rippleSpeed) * 
             rippleFalloff * 0.3;
  }
  
  // Click ripples effect - only calculate if there are active ripples
  let clickRipplesEffect = 0;
  const currentTime = Date.now();
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
  const wave1 = fastSin(posX * 1.5 + timeFactor + normMouseX) * 
                fastCos(posY * 1.5 - timeFactor + normMouseY);
  const wave2 = fastCos(posX * posY * 0.8 + timeFactor * 1.2);
  const spiral = fastSin(Math.sqrt(posX * posX + posY * posY) * 3 - timeFactor * 1.5);
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