import React from 'react';
import { 
  BLOB_CACHE_GRID_SIZE, 
  BORDER_FREQUENCY, 
  CHAR_HEIGHT, 
  HORIZONTAL_PADDING, 
  selectedCharacterSet, 
  characterSetLength 
} from './constants';
import { BlobGridCache, CursorState, TextPositionCacheResult } from './types';

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
  const cursorState = cursorRef.current;
  
  // Handle white overlay if active - this takes precedence over all other effects
  if (cursorState.whiteOverlay && cursorState.whiteOverlay.active) {
    return ' '; // Always return space (white) when overlay is active
  }
  
  // Handle white-in effect if active (takes precedence over whiteout)
  if (cursorState.whiteIn && cursorState.whiteIn.active) {
    const { position, progress } = cursorState.whiteIn;
    
    // Calculate distance from white-in center
    const distX = (x / cols) * 2 - 1 - position.x;
    const distY = (y / rows) * 2 - 1 - position.y;
    const distance = Math.sqrt(distX * distX + distY * distY);
    
    // Calculate the radius of the current white-in circle
    // It starts covering the screen and shrinks to reveal content
    const maxDistance = Math.sqrt(2 * 2 + 2 * 2); // Maximum possible distance in normalized space
    const whiteInRadius = progress * (maxDistance * 1.5); // Start beyond screen bounds and shrink
    
    // If the point is within the white-in radius, render as space
    if (distance <= whiteInRadius) {
      return ' ';
    }
    
    // For points near the edge of the white-in, create a "dissolving" effect
    const edgeWidth = 0.1 + progress * 0.2; // Edge gets wider as the white-in shrinks
    const edgeDistance = Math.abs(distance - whiteInRadius);
    if (edgeDistance < edgeWidth) {
      const noiseThreshold = edgeDistance / edgeWidth; // 0 at edge, 1 at edge + edgeWidth
      // More density of spaces near the edge of the white-in
      if (Math.random() > noiseThreshold * 0.8) {
        return ' ';
      }
    }
    
    // Even for characters outside the white-in zone, add some random spaces to enhance the effect
    if (Math.random() < progress * 0.4) {
      return ' ';
    }
  }
  
  // Handle whiteout effect if active
  if (cursorState.whiteout && cursorState.whiteout.active) {
    const { position, progress } = cursorState.whiteout;
    
    // Check for any text character that might be part of a link
    // and immediately replace it with a space
    const gridKey = `${x},${y}`;
    const fixedChar = textPositionCache.grid[gridKey];
    const scrolledY = Math.floor(scrollY / CHAR_HEIGHT);
    const scrolledGridKey = `${x},${y + scrolledY}`;
    const scrolledChar = textPositionCache.grid[scrolledGridKey];
    
    // If this is a link or part of text that might be styled, replace with space immediately
    if ((fixedChar && fixedChar.fixed) || (scrolledChar && !scrolledChar.fixed)) {
      // Check if it might be a link (underscore is often part of link underlines)
      const char = fixedChar ? fixedChar.char : (scrolledChar ? scrolledChar.char : null);
      if (char === '_' || char === '‾' || char === '-' || char === '⎯' || char === '⎺' || char === '⎻' || char === '⎼' || char === '⎽') {
        return ' ';
      }
    }
    
    // Calculate distance from whiteout center
    const distX = (x / cols) * 2 - 1 - position.x;
    const distY = (y / rows) * 2 - 1 - position.y;
    const distance = Math.sqrt(distX * distX + distY * distY);
    
    // Calculate the radius of the current whiteout circle
    // It starts from the click point and grows to cover the screen
    const maxDistance = Math.sqrt(2 * 2 + 2 * 2); // Maximum possible distance in normalized space
    const whiteoutRadius = progress * (maxDistance * 1.5); // Grow beyond screen bounds to ensure full coverage
    
    // If the point is within the whiteout radius, render as space
    if (distance <= whiteoutRadius) {
      return ' ';
    }
    
    // For points near the edge of the whiteout, create a "dissolving" effect
    const edgeWidth = 0.1 + progress * 0.2; // Edge gets wider as the whiteout grows
    const edgeDistance = Math.abs(distance - whiteoutRadius);
    if (edgeDistance < edgeWidth) {
      const noiseThreshold = edgeDistance / edgeWidth; // 0 at edge, 1 at edge + edgeWidth
      // More density of spaces near the edge of the whiteout
      if (Math.random() > noiseThreshold * 0.8) {
        return ' ';
      }
    }
    
    // Even for characters outside the whiteout zone, add some random spaces to enhance the effect
    if (Math.random() < progress * 0.2) {
      return ' ';
    }
  }
  
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

  // Interior of blob always renders as space
  if (cellValue === 1) {
    return ' ';
  }
  
  // If border region, calculate border effects
  if (cellValue === 2) {
    // Border effect with faster calculation
    const borderEffect = (fastSin(x * BORDER_FREQUENCY + timeFactor * 80) * 
                         fastCos(y * BORDER_FREQUENCY - timeFactor * 40)) * 0.25;
    
    // Simplified border check with higher probability of returning space
    if (borderEffect > -0.15) return ' ';
  }
  
  // BACKGROUND ANIMATION (never paused)
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
  
  const pulseRate = 1.0;
  const pulseIntensity = 0.2;
  const pulse = Math.sin(time * 0.001 * pulseRate) * pulseIntensity + 1;
  
  const rippleSpeed = 1.2;
  const rippleFrequency = 5;
  const rippleDecay = 0.5;
  const ripple = Math.sin(mouseInfluence * rippleFrequency - time * 0.0005 * rippleSpeed) * 
                Math.exp(-mouseInfluence * rippleDecay) * 
                (cursorState.isInWindow ? 0.3 : 0);
  
  // Calculate click ripples effect
  let clickRipplesEffect = 0;
  const currentTime = Date.now();
  
  if (cursorState.clickRipples && cursorState.clickRipples.length > 0) {
    for (const clickRipple of cursorState.clickRipples) {
      const age = currentTime - clickRipple.timestamp;
      if (age >= clickRipple.lifespan) continue;
      
      // Calculate normalized age (0 to 1)
      const normalizedAge = age / clickRipple.lifespan;
      
      // Calculate distance from click point
      const clickDistX = (x / cols) * 2 - 1 - clickRipple.position.x;
      const clickDistY = (y / rows) * 2 - 1 - clickRipple.position.y;
      const clickDistance = Math.sqrt(clickDistX * clickDistX + clickDistY * clickDistY);
      
      // Ripple speed and size factors (ripple grows outward over time)
      const rippleMaxSize = 2.0 + (clickRipple.intensity - 0.5) * 0.6;
      const rippleSize = normalizedAge * rippleMaxSize;
      
      // The ripple's intensity decreases with time
      const intensityDecayRate = clickRipple.intensity >= 0.7 ? 0.7 : 1.0;
      const ageAttenuationFactor = Math.pow(1 - normalizedAge, intensityDecayRate);
      
      // The ripple is strongest at a specific distance from the center
      const rippleWidth = 0.05 + 0.1 * normalizedAge + (clickRipple.intensity - 0.5) * 0.05;
      const distanceFromRippleEdge = Math.abs(clickDistance - rippleSize);
      const ringEffect = Math.exp(-distanceFromRippleEdge * distanceFromRippleEdge / (rippleWidth * rippleWidth));
      
      // Apply secondary wave patterns for organic feel
      const wavePatternIntensity = 0.1 + (clickRipple.intensity - 0.5) * 0.15;
      const wavePattern = Math.sin(clickDistance * 20 - normalizedAge * 30 * clickRipple.speedFactor) * wavePatternIntensity;
      
      // Combine all factors
      let rippleIntensity = clickRipple.intensity * ageAttenuationFactor * ringEffect * (0.9 + wavePattern);
      
      // Add a secondary ring for high-intensity ripples
      if (clickRipple.intensity > 0.8) {
        const secondaryRippleSize = rippleSize * 0.4;
        const secondaryDistanceFromEdge = Math.abs(clickDistance - secondaryRippleSize);
        const secondaryWidth = rippleWidth * 0.6;
        const secondaryRingEffect = Math.exp(-secondaryDistanceFromEdge * secondaryDistanceFromEdge / (secondaryWidth * secondaryWidth));
        
        const secondaryIntensity = rippleIntensity * 0.7 * secondaryRingEffect;
        rippleIntensity += secondaryIntensity;
      }
      
      clickRipplesEffect += rippleIntensity;
    }
    
    // Clamp the effect to a reasonable range
    clickRipplesEffect = Math.min(1.0, clickRipplesEffect);
  }
  
  const wave1 = Math.sin(position.x * 1.5 + timeFactor + cursorState.normalized.x) * 
                Math.cos(position.y * 1.5 - timeFactor + cursorState.normalized.y);
  const wave2 = Math.cos(position.x * position.y * 0.8 + timeFactor * 1.2);
  const spiral = Math.sin(Math.sqrt(position.x * position.x + position.y * position.y) * 3 - timeFactor * 1.5);
  const mouseRipple = Math.sin(mouseInfluence * 5 - timeFactor * 2) / (mouseInfluence + 1);
  
  let combined = (wave1 * 0.3 + wave2 * 0.2 + spiral * 0.2 + mouseRipple * 0.3 + 1) / 2;
  if (cursorState.isInWindow) {
    combined = Math.min(1, combined + cursorEffect * pulse + ripple + clickRipplesEffect);
    if (mouseInfluence < 0.05) {
      combined = 0.95;
    }
  }

  const index = Math.floor(combined * characterSetLength + (Math.floor(x + y) % 2));
  return selectedCharacterSet[index % characterSetLength];
}; 