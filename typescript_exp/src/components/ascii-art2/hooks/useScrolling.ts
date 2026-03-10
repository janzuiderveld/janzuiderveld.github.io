import { useState, useRef, useEffect, useCallback } from 'react';
import { CursorState } from '../types';

const STOP_VELOCITY = 1;
const WHEEL_SCROLL_MULTIPLIER = 0.7;
const WHEEL_INERTIA_MULTIPLIER = 0.5;
const FRICTION = 0.7;
const OVERSCROLL_AMOUNT = 100;

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
  const animationFrameRef = useRef<number | null>(null);

  const touchStartY = useRef(0);
  const touchStartTime = useRef(0);
  const lastTouchY = useRef(0);
  const isTouching = useRef(false);

  const updateCursorScrollingState = useCallback((scrolling: boolean) => {
    if (cursorRef?.current) {
      cursorRef.current.isScrolling = scrolling;
    }
  }, [cursorRef]);

  const clampScrollOffset = useCallback((nextOffset: number) => {
    return Math.max(0, Math.min(maxScroll, nextOffset));
  }, [maxScroll]);

  const commitScrollOffset = useCallback((nextOffset: number) => {
    const clampedOffset = clampScrollOffset(nextOffset);
    scrollOffsetRef.current = clampedOffset;
    setScrollOffset(previous => (
      Math.abs(previous - clampedOffset) > 0.1 ? clampedOffset : previous
    ));
    return clampedOffset;
  }, [clampScrollOffset]);

  const stopMomentumLoop = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const finishScrolling = useCallback(() => {
    isScrolling.current = false;
    scrollVelocity.current = 0;
    updateCursorScrollingState(false);
    requestAnimationFrame(() => {
      updateLinkOverlays();
    });
  }, [updateCursorScrollingState, updateLinkOverlays]);

  const startMomentumLoop = useCallback(() => {
    if (animationFrameRef.current !== null) {
      return;
    }

    lastScrollTime.current = performance.now();

    const step = (timestamp: number) => {
      const elapsed = timestamp - lastScrollTime.current;
      lastScrollTime.current = timestamp;

      if (!isTouching.current && Math.abs(scrollVelocity.current) >= STOP_VELOCITY && elapsed > 0) {
        scrollVelocity.current *= Math.pow(FRICTION, elapsed / 16);
        const nextOffset = commitScrollOffset(scrollOffsetRef.current + scrollVelocity.current);
        if (nextOffset === 0 || nextOffset === maxScroll) {
          scrollVelocity.current = 0;
        }
      }

      if (isTouching.current || Math.abs(scrollVelocity.current) >= STOP_VELOCITY) {
        animationFrameRef.current = requestAnimationFrame(step);
        return;
      }

      animationFrameRef.current = null;
      finishScrolling();
    };

    animationFrameRef.current = requestAnimationFrame(step);
  }, [commitScrollOffset, finishScrolling, maxScroll]);

  useEffect(() => {
    return () => {
      stopMomentumLoop();
    };
  }, [stopMomentumLoop]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      isScrolling.current = true;
      updateCursorScrollingState(true);

      const delta = event.deltaY * WHEEL_SCROLL_MULTIPLIER;
      commitScrollOffset(scrollOffsetRef.current + delta);
      scrollVelocity.current = delta * WHEEL_INERTIA_MULTIPLIER;
      startMomentumLoop();
    };

    const element = containerRef.current;
    element.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      element.removeEventListener('wheel', handleWheel);
    };
  }, [commitScrollOffset, containerRef, startMomentumLoop, updateCursorScrollingState]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        return;
      }

      isTouching.current = true;
      isScrolling.current = true;
      updateCursorScrollingState(true);
      scrollVelocity.current = 0;
      touchStartY.current = event.touches[0].clientY;
      lastTouchY.current = event.touches[0].clientY;
      touchStartTime.current = performance.now();
      stopMomentumLoop();
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (!isTouching.current || event.touches.length !== 1) {
        return;
      }

      event.preventDefault();
      const currentY = event.touches[0].clientY;
      const deltaY = lastTouchY.current - currentY;
      lastTouchY.current = currentY;

      let nextOffset = scrollOffsetRef.current + deltaY;
      nextOffset = Math.max(-OVERSCROLL_AMOUNT, Math.min(maxScroll + OVERSCROLL_AMOUNT, nextOffset));
      if (nextOffset < 0 || nextOffset > maxScroll) {
        nextOffset = scrollOffsetRef.current + deltaY * 0.3;
      }

      scrollOffsetRef.current = nextOffset;
      setScrollOffset(previous => (
        Math.abs(previous - nextOffset) > 0.1 ? nextOffset : previous
      ));
    };

    const handleTouchEnd = () => {
      if (!isTouching.current) {
        return;
      }

      isTouching.current = false;
      const touchEndTime = performance.now();
      const elapsed = Math.max(1, touchEndTime - touchStartTime.current);
      const distance = touchStartY.current - lastTouchY.current;

      if (elapsed < 300) {
        scrollVelocity.current = (distance / elapsed) * 8;
      }

      const clampedOffset = clampScrollOffset(scrollOffsetRef.current);
      if (clampedOffset !== scrollOffsetRef.current) {
        scrollVelocity.current = 0;
      }
      commitScrollOffset(clampedOffset);

      if (Math.abs(scrollVelocity.current) >= STOP_VELOCITY) {
        startMomentumLoop();
        return;
      }

      stopMomentumLoop();
      finishScrolling();
    };

    const element = containerRef.current;
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
  }, [
    clampScrollOffset,
    commitScrollOffset,
    containerRef,
    finishScrolling,
    maxScroll,
    startMomentumLoop,
    stopMomentumLoop,
    updateCursorScrollingState
  ]);

  useEffect(() => {
    const clampedOffset = clampScrollOffset(scrollOffsetRef.current);
    if (clampedOffset !== scrollOffsetRef.current) {
      commitScrollOffset(clampedOffset);
    }
  }, [clampScrollOffset, commitScrollOffset, maxScroll]);

  return {
    scrollOffset,
    setScrollOffset,
    scrollOffsetRef,
    isScrolling,
    scrollVelocity
  };
};
