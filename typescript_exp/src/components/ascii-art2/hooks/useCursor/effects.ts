import { WhiteoutState, WhiteInState, WhiteOverlayState, CursorState } from './types';
import { animateWhiteout, animateWhiteIn, cleanupWhiteoutAnimation, cleanupWhiteInAnimation } from './animations';
import { ClickRipple } from '../../types';

// Whiteout effect - transition to white screen and navigate
export const startWhiteout = (
  cursorRef: React.MutableRefObject<CursorState>,
  position: { x: number; y: number },
  targetUrl: string,
  setCursor: React.Dispatch<React.SetStateAction<CursorState>>
) => {
  // Cleanup any existing whiteout animation
  if (cursorRef.current.whiteout) {
    cleanupWhiteoutAnimation(cursorRef.current.whiteout);
  }
  
  // Create new whiteout state
  const whiteout: WhiteoutState = {
    active: true,
    position,
    timestamp: Date.now(),
    targetUrl,
    progress: 0,
    duration: 800, // 800ms for the full effect
    justStarted: true,
    animationFrame: null,
    startTime: Date.now()
  };
  
  // Update cursor state with new whiteout
  cursorRef.current = {
    ...cursorRef.current,
    whiteout
  };
  
  setCursor(cursorRef.current);
  
  // Start animation
  const updateWhiteout = (updatedWhiteout: WhiteoutState) => {
    if (!cursorRef.current.whiteout) return;
    
    cursorRef.current = {
      ...cursorRef.current,
      whiteout: {
        ...updatedWhiteout,
        justStarted: false
      }
    };
    
    setCursor(cursorRef.current);
  };
  
  // Handle animation completion
  const onComplete = (url: string) => {
    // Navigate to the URL
    window.location.href = url;
  };
  
  // Start the animation
  animateWhiteout(whiteout, updateWhiteout, onComplete);
};

// White-in effect - fade in from white
export const startWhiteIn = (
  cursorRef: React.MutableRefObject<CursorState>,
  position: { x: number; y: number },
  setCursor: React.Dispatch<React.SetStateAction<CursorState>>
) => {
  // Cleanup any existing white-in animation
  if (cursorRef.current.whiteIn) {
    cleanupWhiteInAnimation(cursorRef.current.whiteIn);
  }
  
  // Create new white-in state
  const whiteIn: WhiteInState = {
    active: true,
    position,
    timestamp: Date.now(),
    progress: 1, // Start fully white
    duration: 800, // 800ms for the full fade in
    animationFrame: null,
    startTime: Date.now()
  };
  
  // Update cursor state with new white-in
  cursorRef.current = {
    ...cursorRef.current,
    whiteIn
  };
  
  setCursor(cursorRef.current);
  
  // Start animation
  const updateWhiteIn = (updatedWhiteIn: WhiteInState) => {
    if (!cursorRef.current.whiteIn) return;
    
    cursorRef.current = {
      ...cursorRef.current,
      whiteIn: updatedWhiteIn
    };
    
    setCursor(cursorRef.current);
  };
  
  // Handle animation completion
  const onComplete = () => {
    // Clear the white-in effect when complete
    cursorRef.current = {
      ...cursorRef.current,
      whiteIn: null
    };
    
    setCursor(cursorRef.current);
  };
  
  // Start the animation
  animateWhiteIn(whiteIn, updateWhiteIn, onComplete);
};

// White overlay effect - for page-level brightness
export const activateWhiteOverlay = (
  cursorRef: React.MutableRefObject<CursorState>,
  setCursor: React.Dispatch<React.SetStateAction<CursorState>>
) => {
  const whiteOverlay: WhiteOverlayState = {
    active: true,
    timestamp: Date.now(),
    fadeInComplete: false
  };
  
  cursorRef.current = {
    ...cursorRef.current,
    whiteOverlay
  };
  
  setCursor(cursorRef.current);
};

export const deactivateWhiteOverlay = (
  cursorRef: React.MutableRefObject<CursorState>,
  setCursor: React.Dispatch<React.SetStateAction<CursorState>>
) => {
  if (!cursorRef.current.whiteOverlay) return;
  
  cursorRef.current = {
    ...cursorRef.current,
    whiteOverlay: null
  };
  
  setCursor(cursorRef.current);
};

// Simulate click effect - creates ripple without actual click
export const simulateClick = (
  cursorRef: React.MutableRefObject<CursorState>,
  position: { x: number; y: number },
  maxRipples: number,
  setCursor: React.Dispatch<React.SetStateAction<CursorState>>
) => {
  // Create a simulated ripple
  const ripple: ClickRipple = {
    position,
    timestamp: Date.now(),
    lifespan: 1500,
    intensity: 0.8,
    speedFactor: 1.0
  };
  
  // Add to current click ripples
  const clickRipples = [ripple, ...cursorRef.current.clickRipples]
    .slice(0, maxRipples);
  
  cursorRef.current = {
    ...cursorRef.current,
    clickRipples
  };
  
  setCursor(cursorRef.current);
}; 