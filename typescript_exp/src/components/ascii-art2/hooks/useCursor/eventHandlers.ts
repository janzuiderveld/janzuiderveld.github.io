import { MOUSE_MOVE_THROTTLE, SAFARI_CURSOR_Y_OFFSET } from '../../constants';
import { ClickRipple } from '../../types';
import { CursorState, MouseDownInfo } from './types';
import { updateCursorPosition } from './cursorPosition';
import { updateRipples } from './animations';

export const setupMouseHandlers = (
  textRef: React.RefObject<HTMLPreElement>,
  size: { width: number | null, height: number | null },
  cursorRef: React.MutableRefObject<CursorState>,
  setCursor: React.Dispatch<React.SetStateAction<CursorState>>,
  mouseDownInfo: React.MutableRefObject<MouseDownInfo | null>,
  lastMouseMoveTime: React.MutableRefObject<number>,
  maxRipples: number,
  updateCursorPositionCallback: (relativeX: number, relativeY: number, isTouchStart?: boolean) => void
) => {
  const handleMouseMove = (e: MouseEvent) => {
    const now = performance.now();
    if (now - lastMouseMoveTime.current < MOUSE_MOVE_THROTTLE) {
      return;
    }
    lastMouseMoveTime.current = now;
    
    if (!size.width || !size.height || !textRef.current) return;
    
    // Skip mouse tracking if whiteout is active
    if (cursorRef.current.whiteout?.active || cursorRef.current.whiteIn?.active) {
      return;
    }
    
    const rect = textRef.current.getBoundingClientRect();
    const relativeX = e.clientX - rect.left;
    const relativeY = e.clientY - rect.top + SAFARI_CURSOR_Y_OFFSET;
    
    updateCursorPositionCallback(relativeX, relativeY);
  };

  const handleMouseLeave = () => {
    cursorRef.current = {
      ...cursorRef.current,
      isInWindow: false
    };
    setCursor(cursorRef.current);
  };

  const handleMouseEnter = () => {
    cursorRef.current = {
      ...cursorRef.current,
      isInWindow: true
    };
    setCursor(cursorRef.current);
  };
  
  const handleMouseDown = (e: MouseEvent) => {
    if (!size.width || !size.height || !textRef.current) return;
    
    const rect = textRef.current.getBoundingClientRect();
    const relativeX = e.clientX - rect.left;
    const relativeY = e.clientY - rect.top + SAFARI_CURSOR_Y_OFFSET;
    
    const normalizedX = (relativeX / (size.width || 1)) * 2 - 1;
    const normalizedY = (relativeY / (size.height || 1)) * 2 - 1;
    
    // Initialize mousedown tracking
    mouseDownInfo.current = {
      active: true,
      position: { x: normalizedX, y: normalizedY },
      startTime: Date.now()
    };
    
    // Create an initial small mousedown ripple effect
    const initialRipple: ClickRipple = {
      position: { x: normalizedX, y: normalizedY },
      timestamp: Date.now(),
      lifespan: 800, // Shorter lifespan for initial ripple
      intensity: 0.3, // Lower intensity for initial effect
      speedFactor: 1.0
    };
    
    const updatedRipples = [initialRipple, ...cursorRef.current.clickRipples]
      .slice(0, maxRipples);
    
    cursorRef.current = {
      ...cursorRef.current,
      isActive: true,
      clickRipples: updatedRipples
    };
    
    setCursor(cursorRef.current);
  };
  
  const handleMouseUp = (e: MouseEvent) => {
    if (!mouseDownInfo.current?.active || !size.width || !size.height || !textRef.current) {
      // If no active mousedown, just update the isActive state
      cursorRef.current = {
        ...cursorRef.current,
        isActive: false
      };
      setCursor(cursorRef.current);
      return;
    }
    
    // Calculate hold duration
    const holdDuration = Date.now() - mouseDownInfo.current.startTime;
    
    // Get current mouse position for the ripple
    const rect = textRef.current.getBoundingClientRect();
    const relativeX = e.clientX - rect.left;
    const relativeY = e.clientY - rect.top + SAFARI_CURSOR_Y_OFFSET;
    
    const normalizedX = (relativeX / (size.width || 1)) * 2 - 1;
    const normalizedY = (relativeY / (size.height || 1)) * 2 - 1;
    
    // Intensity increases with hold duration (clamped to reasonable max)
    // Map holdDuration from 0-2000ms to intensity 0.5-1.0
    const holdIntensity = Math.min(1.0, 0.5 + (holdDuration / 2000) * 0.5);
    
    // Lifespan also increases with hold duration
    // Map holdDuration from 0-2000ms to lifespan 1000-3000ms
    const holdLifespan = 1000 + (holdDuration / 2000) * 2000;
    
    // Generate random speed factor between 0.8-1.5 with slight bias based on hold duration
    const speedBoost = Math.min(0.3, holdDuration / 5000); // Small boost based on hold time
    const speedFactor = 0.8 + Math.random() * 0.7 + speedBoost;
    
    // New ripple with timestamp
    const newRipple: ClickRipple = {
      position: { x: normalizedX, y: normalizedY },
      timestamp: Date.now(),
      lifespan: holdLifespan,
      intensity: holdIntensity,
      speedFactor
    };
    
    // Add new ripple and maintain maximum ripples limit
    const updatedRipples = [newRipple, ...cursorRef.current.clickRipples]
      .slice(0, maxRipples);
    
    cursorRef.current = {
      ...cursorRef.current,
      isActive: false,
      clickRipples: updatedRipples
    };
    
    setCursor(cursorRef.current);
    
    // Reset mousedown tracking
    mouseDownInfo.current = null;
  };

  const handleClick = (e: MouseEvent) => {
    // This is now just a fallback handler for click events
    // Only create a ripple if there was no mousedown/mouseup sequence
    if (mouseDownInfo.current === null && !cursorRef.current.whiteout?.active) {
      if (!size.width || !size.height || !textRef.current) return;
      
      const rect = textRef.current.getBoundingClientRect();
      const relativeX = e.clientX - rect.left;
      const relativeY = e.clientY - rect.top + SAFARI_CURSOR_Y_OFFSET;
      
      const normalizedX = (relativeX / (size.width || 1)) * 2 - 1;
      const normalizedY = (relativeY / (size.height || 1)) * 2 - 1;
      
      // Generate fallback ripple with default values
      const lifespan = 1000 + Math.random() * 2000;
      const intensity = 0.5 + Math.random() * 0.5;
      const speedFactor = 0.8 + Math.random() * 0.7;
      
      const newRipple: ClickRipple = {
        position: { x: normalizedX, y: normalizedY },
        timestamp: Date.now(),
        lifespan,
        intensity,
        speedFactor
      };
      
      const updatedRipples = [newRipple, ...cursorRef.current.clickRipples]
        .slice(0, maxRipples);
      
      cursorRef.current = {
        ...cursorRef.current,
        clickRipples: updatedRipples
      };
      
      setCursor(cursorRef.current);
    }
  };

  return {
    handleMouseMove,
    handleMouseLeave,
    handleMouseEnter,
    handleMouseDown,
    handleMouseUp,
    handleClick
  };
};

export const handleTouchStart = (
  e: TouchEvent,
  textRef: React.RefObject<HTMLPreElement>,
  size: { width: number | null, height: number | null },
  cursorRef: React.MutableRefObject<CursorState>,
  setCursor: React.Dispatch<React.SetStateAction<CursorState>>,
  maxRipples: number,
  updateCursorPositionCallback: (relativeX: number, relativeY: number, isTouchStart?: boolean) => void
) => {
  if (!textRef.current || !size.width || !size.height) return;
  
  if (e.touches.length !== 1) return;
  
  const touch = e.touches[0];
  const rect = textRef.current.getBoundingClientRect();
  const relativeX = touch.clientX - rect.left;
  const relativeY = touch.clientY - rect.top + SAFARI_CURSOR_Y_OFFSET;
  
  // Update cursor position
  updateCursorPositionCallback(relativeX, relativeY, true);
  
  // Create ripple effect for touch
  const normalizedX = (relativeX / size.width) * 2 - 1;
  const normalizedY = (relativeY / size.height) * 2 - 1;
  
  const ripple: ClickRipple = {
    position: { x: normalizedX, y: normalizedY },
    timestamp: Date.now(),
    lifespan: 1200,
    intensity: 0.6,
    speedFactor: 1.2
  };
  
  const updatedRipples = [ripple, ...cursorRef.current.clickRipples]
    .slice(0, maxRipples);
  
  cursorRef.current = {
    ...cursorRef.current,
    clickRipples: updatedRipples,
    isActive: true
  };
  
  setCursor(cursorRef.current);
};

export const handleTouchEnd = (
  cursorRef: React.MutableRefObject<CursorState>,
  setCursor: React.Dispatch<React.SetStateAction<CursorState>>
) => {
  cursorRef.current = {
    ...cursorRef.current,
    isActive: false
  };
  
  setCursor(cursorRef.current);
}; 