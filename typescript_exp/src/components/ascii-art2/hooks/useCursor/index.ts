import { useState, useRef, useEffect } from 'react';
import { UseCursorParams, UseCursorResult, CursorState, MouseDownInfo } from './types';
import { updateCursorPosition as updatePosition, handleTouchPosition } from './cursorPosition';
import { startWhiteout as initiateWhiteout, startWhiteIn as initiateWhiteIn, activateWhiteOverlay as activate, deactivateWhiteOverlay as deactivate, simulateClick as simulate } from './effects';
import { setupMouseHandlers, handleTouchStart, handleTouchEnd } from './eventHandlers';
import { updateRipples, cleanupWhiteoutAnimation, cleanupWhiteInAnimation } from './animations';

export const useCursor = ({ textRef, size }: UseCursorParams): UseCursorResult => {
  // Initialize state with refs for performance
  const cursorRef = useRef<CursorState>({
    grid: { x: 0, y: 0 },
    normalized: { x: 0, y: 0 },
    isInWindow: false,
    isActive: false,
    clickRipples: [],
    whiteout: null,
    whiteIn: null,
    whiteOverlay: null
  });
  
  const [cursor, setCursor] = useState(cursorRef.current);
  const lastMouseMoveTime = useRef(0);
  const maxRipples = 5; // Maximum number of active ripples at once
  const whiteInAnimationRef = useRef<number | null>(null);
  const whiteoutAnimationRef = useRef<number | null>(null);
  const whiteOverlayAnimationRef = useRef<number | null>(null);
  // Add mousedown tracking for hold duration
  const mouseDownInfo = useRef<MouseDownInfo | null>(null);

  // Cursor position update function
  const updateCursorPosition = (relativeX: number, relativeY: number, isTouchStart: boolean = false) => {
    updatePosition(cursorRef, size, relativeX, relativeY, isTouchStart);
    setCursor(cursorRef.current);
  };
  
  // Whiteout effect initialization
  const startWhiteout = (position: { x: number; y: number }, targetUrl: string) => {
    initiateWhiteout(cursorRef, position, targetUrl, setCursor);
  };
  
  // White-in effect initialization
  const startWhiteIn = (position: { x: number; y: number }) => {
    initiateWhiteIn(cursorRef, position, setCursor);
  };
  
  // White overlay for page brightness
  const activateWhiteOverlay = () => {
    activate(cursorRef, setCursor);
  };
  
  const deactivateWhiteOverlay = () => {
    deactivate(cursorRef, setCursor);
  };
  
  // Simulate click effect
  const simulateClick = (position: { x: number; y: number }) => {
    simulate(cursorRef, position, maxRipples, setCursor);
  };
  
  // Set up mouse event handlers
  useEffect(() => {
    const handlers = setupMouseHandlers(
      textRef,
      size,
      cursorRef,
      setCursor,
      mouseDownInfo,
      lastMouseMoveTime,
      maxRipples,
      updateCursorPosition
    );
    
    // Custom touch handler that uses handleTouchPosition
    const handleTouchMove = (e: TouchEvent) => {
      handleTouchPosition(e, textRef, updateCursorPosition);
    };
    
    // Setup touch handlers
    const touchStartHandler = (e: TouchEvent) => {
      handleTouchStart(
        e, 
        textRef, 
        size, 
        cursorRef, 
        setCursor, 
        maxRipples, 
        updateCursorPosition
      );
      e.preventDefault();
    };
    
    // Add event listeners
    window.addEventListener('mousemove', handlers.handleMouseMove, { passive: true });
    window.addEventListener('mouseenter', handlers.handleMouseEnter);
    window.addEventListener('mouseleave', handlers.handleMouseLeave);
    window.addEventListener('mousedown', handlers.handleMouseDown);
    window.addEventListener('mouseup', handlers.handleMouseUp);
    window.addEventListener('click', handlers.handleClick);
    
    // Add touch event listeners
    const element = textRef.current;
    if (element) {
      element.addEventListener('touchstart', touchStartHandler, { passive: false });
      element.addEventListener('touchmove', handleTouchMove, { passive: false });
      element.addEventListener('touchend', () => handleTouchEnd(cursorRef, setCursor));
      element.addEventListener('touchcancel', () => handleTouchEnd(cursorRef, setCursor));
    }
    
    // Cleanup event listeners on unmount
    return () => {
      window.removeEventListener('mousemove', handlers.handleMouseMove);
      window.removeEventListener('mouseenter', handlers.handleMouseEnter);
      window.removeEventListener('mouseleave', handlers.handleMouseLeave);
      window.removeEventListener('mousedown', handlers.handleMouseDown);
      window.removeEventListener('mouseup', handlers.handleMouseUp);
      window.removeEventListener('click', handlers.handleClick);
      
      if (element) {
        element.removeEventListener('touchstart', touchStartHandler);
        element.removeEventListener('touchmove', handleTouchMove);
        element.removeEventListener('touchend', () => handleTouchEnd(cursorRef, setCursor));
        element.removeEventListener('touchcancel', () => handleTouchEnd(cursorRef, setCursor));
      }
      
      // Cleanup animations
      if (whiteoutAnimationRef.current) cancelAnimationFrame(whiteoutAnimationRef.current);
      if (whiteInAnimationRef.current) cancelAnimationFrame(whiteInAnimationRef.current);
      if (whiteOverlayAnimationRef.current) cancelAnimationFrame(whiteOverlayAnimationRef.current);
      
      if (cursorRef.current.whiteout) cleanupWhiteoutAnimation(cursorRef.current.whiteout);
      if (cursorRef.current.whiteIn) cleanupWhiteInAnimation(cursorRef.current.whiteIn);
    };
  }, [size, textRef]);
  
  // Regularly update and clean expired ripples
  useEffect(() => {
    const rippleInterval = setInterval(() => {
      if (cursorRef.current.clickRipples.length > 0) {
        const updatedRipples = updateRipples(cursorRef.current.clickRipples, maxRipples);
        
        // Only update if ripples have changed
        if (updatedRipples.length !== cursorRef.current.clickRipples.length) {
          cursorRef.current = {
            ...cursorRef.current,
            clickRipples: updatedRipples
          };
          setCursor(cursorRef.current);
        }
      }
    }, 500);
    
    return () => clearInterval(rippleInterval);
  }, []);
  
  return {
    cursor,
    startWhiteout,
    startWhiteIn,
    activateWhiteOverlay,
    deactivateWhiteOverlay,
    simulateClick,
    updateCursorPosition
  };
};

export * from './types';
export * from './animations';
export * from './cursorPosition';
export * from './effects';
export * from './eventHandlers'; 