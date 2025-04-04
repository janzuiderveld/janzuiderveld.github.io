import { WhiteoutState, WhiteInState } from './types';

export const animateWhiteout = (
  whiteout: WhiteoutState,
  updateWhiteout: (updatedWhiteout: WhiteoutState) => void,
  onComplete: (url: string) => void
) => {
  const updateAnimation = () => {
    if (!whiteout || !whiteout.active) return;
    
    const elapsed = Date.now() - whiteout.startTime;
    const progress = Math.min(1, elapsed / whiteout.duration);
    
    // Update the whiteout state with new progress
    updateWhiteout({
      ...whiteout,
      progress: progress
    });
    
    // Continue animation if not complete
    if (progress < 1) {
      whiteout.animationFrame = requestAnimationFrame(updateAnimation);
    } else {
      // Complete the whiteoout effect
      onComplete(whiteout.targetUrl);
    }
  };
  
  // Start the animation loop
  updateAnimation();
};

export const animateWhiteIn = (
  whiteIn: WhiteInState,
  updateWhiteIn: (updatedWhiteIn: WhiteInState) => void,
  onComplete: () => void
) => {
  const updateAnimation = () => {
    if (!whiteIn || !whiteIn.active) return;
    
    const elapsed = Date.now() - whiteIn.startTime;
    const progress = Math.min(1, elapsed / whiteIn.duration);
    
    // Update the white-in state with new progress
    updateWhiteIn({
      ...whiteIn,
      progress: progress
    });
    
    // Continue animation if not complete
    if (progress < 1) {
      whiteIn.animationFrame = requestAnimationFrame(updateAnimation);
    } else {
      // Animation complete
      onComplete();
    }
  };
  
  // Start the animation loop
  updateAnimation();
};

export const cleanupAnimation = (
  animationRef: React.MutableRefObject<number | null>
) => {
  if (animationRef.current !== null) {
    cancelAnimationFrame(animationRef.current);
    animationRef.current = null;
  }
};

export const cleanupWhiteoutAnimation = (
  whiteout: WhiteoutState | null
) => {
  if (whiteout && whiteout.animationFrame !== null) {
    cancelAnimationFrame(whiteout.animationFrame);
  }
};

export const cleanupWhiteInAnimation = (
  whiteIn: WhiteInState | null
) => {
  if (whiteIn && whiteIn.animationFrame !== null) {
    cancelAnimationFrame(whiteIn.animationFrame);
  }
};

export const updateRipples = (
  clickRipples: Array<{ 
    position: { x: number; y: number }; 
    timestamp: number; 
    lifespan: number; 
    intensity: number; 
    speedFactor: number; 
  }>,
  maxRipples: number
) => {
  const now = Date.now();
  // Filter out expired ripples
  return clickRipples
    .filter(ripple => now - ripple.timestamp < ripple.lifespan)
    .slice(0, maxRipples);
}; 