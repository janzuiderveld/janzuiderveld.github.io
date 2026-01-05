import { useState, useRef, useEffect, useCallback } from 'react';
import { CHAR_HEIGHT } from '../constants';
import { CursorState } from '../types';

export const useScrolling = (
  maxScroll: number,
  containerRef: React.RefObject<HTMLDivElement>,
  updateLinkOverlays: () => void,
  cursorRef?: React.MutableRefObject<CursorState>
) => {
  const [scrollOffset, setScrollOffset] = useState(0);
  const scrollOffsetRef = useRef(0);
  const isScrolling = useRef(false);
  const scrollVelocity = useRef(0);
  const lastScrollTime = useRef(0);
  const scrollTimeoutRef = useRef<number | null>(null);
  const prevScrollChunkRef = useRef(0);
  const [isScrollingState, setIsScrollingState] = useState(false);

  // Touch gesture state
  const touchStartY = useRef(0);
  const touchStartTime = useRef(0);
  const lastTouchY = useRef(0);
  const isTouching = useRef(false);

  // Helper function to update cursor scrolling state
  const updateCursorScrollingState = (scrolling: boolean) => {
    if (cursorRef?.current) {
      cursorRef.current.isScrolling = scrolling;
    }
  };

  // Enhanced scrolling effect with speed detection and better link overlay updates
  useEffect(() => {
    let animationFrameId: number;
    let lastAppliedOffset = scrollOffset; // Track the last offset applied to state

    const updateScroll = (timestamp: number) => {
      const elapsed = timestamp - lastScrollTime.current;
      lastScrollTime.current = timestamp;

      let needsStateUpdate = false;

      // Handle inertial scrolling (velocity changes the target offset)
      if (scrollVelocity.current !== 0 && elapsed > 0) {
        // Significantly increased friction for faster stopping
        const friction = 0.7;
        scrollVelocity.current *= Math.pow(friction, elapsed / 16);

        // Increased threshold for stopping scrolling
        if (Math.abs(scrollVelocity.current) < 1.0) {
          scrollVelocity.current = 0;
          isScrolling.current = false;
          setIsScrollingState(false);
          updateCursorScrollingState(false); // Update cursor state
          
          // Update link overlays when scrolling stops
          requestAnimationFrame(() => {
            updateLinkOverlays();
          });
        } else {
          let newOffset = scrollOffsetRef.current + scrollVelocity.current;
          newOffset = Math.max(0, Math.min(maxScroll, newOffset));
          if (newOffset === 0 || newOffset === maxScroll) {
            scrollVelocity.current = 0;
            isScrolling.current = false;
            setIsScrollingState(false);
            updateCursorScrollingState(false); // Update cursor state
            
            // Update link overlays when hitting boundaries
            requestAnimationFrame(() => {
              updateLinkOverlays();
            });
          }
          // Update the ref with the new target offset from inertia
          scrollOffsetRef.current = newOffset;
        }
      }

      // Check if the target offset (ref) differs from the current state offset
      // Use a small tolerance to avoid floating point issues
      if (Math.abs(scrollOffsetRef.current - lastAppliedOffset) > 0.1) {
        needsStateUpdate = true;
        lastAppliedOffset = scrollOffsetRef.current; // Update tracker
      }

      // Apply state update if needed
      if (needsStateUpdate) {
        setScrollOffset(scrollOffsetRef.current);
      }

      animationFrameId = requestAnimationFrame(updateScroll);
    };

    animationFrameId = requestAnimationFrame(updateScroll);
    return () => cancelAnimationFrame(animationFrameId);
  }, [maxScroll, scrollOffset, updateLinkOverlays]);

  // Force link overlay update after scrolling stops
  useEffect(() => {
    if (isScrollingState) {
      // While scrolling, set a timeout to update overlays once scrolling stops
      const updateTimeout = window.setTimeout(() => {
        if (!isScrolling.current) {
          updateCursorScrollingState(false); // Update cursor state
          requestAnimationFrame(() => {
            updateLinkOverlays();
          });
        }
      }, 50);
      
      return () => {
        window.clearTimeout(updateTimeout);
      };
    } else {
      // When scrolling stops, ensure overlays are updated
      updateCursorScrollingState(false); // Update cursor state
      requestAnimationFrame(() => {
        updateLinkOverlays();
      });
    }
  }, [isScrollingState, updateLinkOverlays]);

  // Wheel scroll
  useEffect(() => {
    if (!containerRef.current) return;
    
    const handleWheel = (e: WheelEvent) => {
      // Always prevent default scroll behavior within the component area
      e.preventDefault();
      isScrolling.current = true;
      setIsScrollingState(true);
      updateCursorScrollingState(true); // Update cursor state
      
      const scrollMultiplier = 0.7;
      const delta = e.deltaY * scrollMultiplier;
      
      let newScrollOffset = scrollOffsetRef.current + delta;
      newScrollOffset = Math.max(0, Math.min(maxScroll, newScrollOffset));
      
      scrollOffsetRef.current = newScrollOffset;
      requestAnimationFrame(() => {
        setScrollOffset(newScrollOffset);
      });
      
      scrollVelocity.current = delta * 0.5;
      lastScrollTime.current = performance.now();
      
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      
      // Set timeout for stopping scrolling and updating links
      scrollTimeoutRef.current = window.setTimeout(() => {
        isScrolling.current = false;
        setIsScrollingState(false);
        updateCursorScrollingState(false); // Update cursor state
        
        // Force link overlay update after scrolling
        requestAnimationFrame(() => {
          updateLinkOverlays();
        });
      }, 100); // Increased to 100ms for better detection of scroll end
    };
    
    const element = containerRef.current;
    element.addEventListener('wheel', handleWheel, { passive: false });
    
    return () => {
      if (element) {
        element.removeEventListener('wheel', handleWheel);
      }
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [maxScroll, updateLinkOverlays, containerRef]);

  // Touch events for mobile
  useEffect(() => {
    if (!containerRef.current) return;
    
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
      setIsScrollingState(true);
      updateCursorScrollingState(true); // Update cursor state
      
      const currentY = e.touches[0].clientY;
      const deltaY = lastTouchY.current - currentY;
      lastTouchY.current = currentY;
      
      let newScrollOffset = scrollOffsetRef.current + deltaY;
      const overscrollAmount = 100;
      newScrollOffset = Math.max(-overscrollAmount, Math.min(maxScroll + overscrollAmount, newScrollOffset));
      if (newScrollOffset < 0 || newScrollOffset > maxScroll) {
        // Apply reduced delta for overscroll effect
        newScrollOffset = scrollOffsetRef.current + deltaY * 0.3;
      }
      
      // Update the ref directly, state update will happen in requestAnimationFrame
      scrollOffsetRef.current = newScrollOffset;
    };
    
    const handleTouchEnd = () => {
      if (!isTouching.current) return;
      isTouching.current = false;
      
      const touchEndTime = performance.now();
      const timeElapsed = touchEndTime - touchStartTime.current;
      
      if (timeElapsed < 300) {
        const distance = touchStartY.current - lastTouchY.current;
        const velocity = distance / timeElapsed * 8;
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
      
      // Set timeout to update scrolling state and force link overlay update
      setTimeout(() => {
        isScrolling.current = false;
        setIsScrollingState(false);
        updateCursorScrollingState(false); // Update cursor state
        
        // Force link overlay update after touch end
        requestAnimationFrame(() => {
          updateLinkOverlays();
        });
      }, 100); // Increased to 100ms for better detection of touch end
    };
    
    const element = containerRef.current;
    
    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });
    element.addEventListener('touchcancel', handleTouchEnd, { passive: true });
    
    return () => {
      if (element) {
        element.removeEventListener('touchstart', handleTouchStart);
        element.removeEventListener('touchmove', handleTouchMove);
        element.removeEventListener('touchend', handleTouchEnd);
        element.removeEventListener('touchcancel', handleTouchEnd);
      }
    };
  }, [maxScroll, containerRef, updateLinkOverlays]);

  // Update scrollOffset when scrollOffset state changes
  useEffect(() => {
    scrollOffsetRef.current = scrollOffset;
  }, [scrollOffset]);

  // Check if we need to update the cache when scrolling
  const checkScrollChunk = useCallback((onScrollChunkChange: () => void) => {
    const SMALL_SCROLL_CHUNK_SIZE = CHAR_HEIGHT * 3;
    const scrollChunk = Math.floor(scrollOffset / SMALL_SCROLL_CHUNK_SIZE);
    
    if (scrollChunk !== prevScrollChunkRef.current) {
      prevScrollChunkRef.current = scrollChunk;
      onScrollChunkChange();
      
      // Force link overlay update when scroll chunk changes
      requestAnimationFrame(() => {
        updateLinkOverlays();
      });
    }
  }, [scrollOffset, updateLinkOverlays]);

  return {
    scrollOffset,
    setScrollOffset,
    scrollOffsetRef,
    isScrolling,
    scrollVelocity,
    lastScrollTime,
    scrollTimeoutRef,
    prevScrollChunkRef,
    checkScrollChunk
  };
};
