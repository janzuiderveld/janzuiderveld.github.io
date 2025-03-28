import { useState, useRef, useEffect, useCallback } from 'react';
import { CHAR_HEIGHT } from '../constants';

export const useScrolling = (
  maxScroll: number,
  textRef: React.RefObject<HTMLPreElement>,
  updateLinkOverlays: () => void
) => {
  const [scrollOffset, setScrollOffset] = useState(0);
  const scrollOffsetRef = useRef(0);
  const isScrolling = useRef(false);
  const scrollVelocity = useRef(0);
  const lastScrollTime = useRef(0);
  const scrollTimeoutRef = useRef<number | null>(null);
  const prevScrollChunkRef = useRef(0);

  // Touch gesture state
  const touchStartY = useRef(0);
  const touchStartTime = useRef(0);
  const lastTouchY = useRef(0);
  const isTouching = useRef(false);

  // Enhanced scrolling effect with speed detection
  useEffect(() => {
    let animationFrameId: number;
    
    const updateScroll = (timestamp: number) => {
      const elapsed = timestamp - lastScrollTime.current;
      lastScrollTime.current = timestamp;
      
      if (elapsed > 0) {
        if (scrollVelocity.current !== 0) {
          // Significantly increased friction for faster stopping
          const friction = 0.7; // Changed from 0.85 to 0.7
          scrollVelocity.current *= Math.pow(friction, elapsed / 16);
          
          // Increased threshold for stopping scrolling from 0.5 to 1.0
          if (Math.abs(scrollVelocity.current) < 1.0) {
            scrollVelocity.current = 0;
            // Immediately set isScrolling to false once velocity is very low
            isScrolling.current = false;
          } else {
            let newOffset = scrollOffsetRef.current + scrollVelocity.current;
            newOffset = Math.max(0, Math.min(maxScroll, newOffset));
            if (newOffset === 0 || newOffset === maxScroll) {
              scrollVelocity.current = 0;
              // Also immediately set isScrolling to false when hitting boundaries
              isScrolling.current = false;
            }
            scrollOffsetRef.current = newOffset;
            setScrollOffset(newOffset);
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
      
      const scrollMultiplier = 0.7;
      let delta = e.deltaY * scrollMultiplier;
      
      let newScrollOffset = scrollOffsetRef.current + delta;
      newScrollOffset = Math.max(0, Math.min(maxScroll, newScrollOffset));
      
      scrollOffsetRef.current = newScrollOffset;
      requestAnimationFrame(() => {
        setScrollOffset(newScrollOffset);
        // Force update link overlays when scrolling
        updateLinkOverlays();
      });
      
      scrollVelocity.current = delta * 0.5;
      lastScrollTime.current = performance.now();
      
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      
      // Set a very short timeout (10ms) for stopping scrolling
      scrollTimeoutRef.current = window.setTimeout(() => {
        isScrolling.current = false;
      }, 10); // Reduced from 50ms to 10ms
    };
    
    const element = textRef.current;
    element.addEventListener('wheel', handleWheel, { passive: false });
    
    return () => {
      element.removeEventListener('wheel', handleWheel);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [maxScroll, updateLinkOverlays, textRef]);

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
      
      setTimeout(() => {
        isScrolling.current = false;
      }, 10); // Reduced from 30ms to 10ms for touch scrolling
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
  }, [maxScroll, textRef]);

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
    }
  }, [scrollOffset]);

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