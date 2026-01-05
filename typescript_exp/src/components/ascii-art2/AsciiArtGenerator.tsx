import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { AsciiArtGeneratorProps, Size, LinkPosition, TextBounds } from './types';
import { 
  SCALE_FACTOR, 
  CHAR_HEIGHT, 
  CHAR_WIDTH, 
  IS_SAFARI, 
  SAFARI_LINK_OFFSET_BASE, 
  SAFARI_LINK_OFFSET_FACTOR,
  DEBUG_LINK_OVERLAYS,
  updateCharMetricsForViewport,
  getCurrentCharMetrics
} from './constants';
import { createSinTable, createCosTable, createFastSin, createFastCos } from './utils';
import { getTextItemKey } from './hooks/useTextPositioning/positioning';
import { 
  useTextPositioning,
  useBlobCache,
  useScrolling,
  useCursor,
  useLinks,
  useContentHeight,
  useAnimation
} from './hooks';
import { calculateCharacter, CharacterPrecomputation } from './renderer';

const AsciiArtGenerator: React.FC<AsciiArtGeneratorProps> = ({ 
  textContent, 
  maxScrollHeight,
  onScrollOffsetChange,
  onLayoutChange,
  onAsciiClickStart,
  onAsciiClickComplete,
  asciiClickTargets,
  pauseAnimation = false,
  transparentBackground = false,
  disableLinks = false,
  initialScrollOffset,
  whiteInRequest,
  externalContainerRef
}) => {
  // Log Safari detection status for debugging
  // console.log(`Browser detection - IS_SAFARI: ${IS_SAFARI}`, navigator.userAgent);
  
  const textRef = useRef<HTMLPreElement>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<Size>({ height: null, width: null });
  const scrollOffsetRef = useRef<number>(0);
  const appliedInitialScrollRef = useRef<number | null>(null);
  const [contentLoaded, setContentLoaded] = useState(false);
  const setContainerRef = useCallback((node: HTMLDivElement | null) => {
    containerRef.current = node;
    if (externalContainerRef) {
      externalContainerRef.current = node;
    }
  }, [externalContainerRef]);
  
  // Use ref to track content state
  const contentStateRef = useRef({
    whiteInStarted: false,
    pageUrl: typeof window !== 'undefined' ? window.location.href : '',
    needsWhiteIn: true
  });

  // Initialize trig tables once to avoid redundant allocations during rerenders
  const { fastSin, fastCos } = useMemo(() => {
    const sinTable = createSinTable();
    const cosTable = createCosTable();

    return {
      fastSin: createFastSin(sinTable),
      fastCos: createFastCos(cosTable)
    };
  }, []);

  // Link state management - Needs to be declared before useTextPositioning
  const [linkPositions, setLinkPositions] = useState<LinkPosition[]>([]);
  const linkPositionsRef = useRef<LinkPosition[]>([]);
  const [hoveredLinkIndex, setHoveredLinkIndex] = useState<number | null>(null);
  const [isAsciiClickHovered, setIsAsciiClickHovered] = useState(false);

  // Text positioning - Calculate this *before* content height
  const textPositionCache = useTextPositioning(
    textContent,
    size,
    setLinkPositions,
    linkPositionsRef
  );

  const namedBounds = useMemo(() => {
    const next: Record<string, TextBounds> = {};
    textContent.forEach(item => {
      if (!item.name) return;
      const key = getTextItemKey(item.name, item.text, item.x, item.y);
      const bounds = textPositionCache.bounds[key];
      if (bounds) {
        next[item.name] = bounds;
      }
    });
    return next;
  }, [textContent, textPositionCache.bounds]);

  const namedRawBounds = useMemo(() => {
    const next: Record<string, TextBounds> = {};
    textContent.forEach(item => {
      if (!item.name) return;
      const key = getTextItemKey(item.name, item.text, item.x, item.y);
      const positions = textPositionCache.cache[key];
      if (!positions?.length) return;

      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;

      positions.forEach(pos => {
        minX = Math.min(minX, pos.startX);
        maxX = Math.max(maxX, pos.endX);
        minY = Math.min(minY, pos.y);
        maxY = Math.max(maxY, pos.y);
      });

      if (minX !== Infinity && minY !== Infinity) {
        next[item.name] = {
          minX,
          maxX,
          minY,
          maxY,
          fixed: textPositionCache.bounds[key]?.fixed ?? false
        };
      }
    });
    return next;
  }, [textContent, textPositionCache.cache, textPositionCache.bounds]);

  useEffect(() => {
    if (onLayoutChange) {
      onLayoutChange({ namedBounds, namedRawBounds, size });
    }
  }, [namedBounds, namedRawBounds, onLayoutChange, size]);


  // Content height calculations - Use the calculated bounds
  const { maxScroll } = useContentHeight(
    textPositionCache.bounds, // Pass the bounds from textPositionCache
    size, 
    maxScrollHeight
  );

  // Blob cache management
  const { 
    blobGridCache, 
    needsRebuildRef, 
    rebuildCacheTimeoutRef, 
    buildBlobCache 
  } = useBlobCache(textPositionCache, size);

  // Cursor tracking with white-in/whiteout support
  const { cursor, cursorRef, startWhiteout, startWhiteIn } = useCursor(textRef, size);
  const isWhiteoutActive = Boolean(cursor.whiteout?.active);
  const isWhiteInActive = Boolean(cursor.whiteIn?.active);
  const hasAsciiClickHandlers = Boolean(onAsciiClickStart || onAsciiClickComplete);
  const isAsciiClickTarget = useCallback((
    clientX: number,
    clientY: number,
    target: EventTarget | null
  ) => {
    if (!hasAsciiClickHandlers) {
      return false;
    }

    if (isWhiteoutActive || isWhiteInActive) {
      return false;
    }

    const element = target instanceof HTMLElement ? target : null;
    if (element?.closest?.('[data-link-overlay="true"]')) {
      return false;
    }

    if (!asciiClickTargets || asciiClickTargets.length === 0) {
      return true;
    }

    const rect = textRef.current?.getBoundingClientRect();
    if (!rect) {
      return false;
    }

    const { charWidth, charHeight } = getCurrentCharMetrics();
    if (!charWidth || !charHeight) {
      return false;
    }

    const relativeX = clientX - rect.left;
    const relativeY = clientY - rect.top;
    const col = Math.floor(relativeX / charWidth);
    const row = Math.floor(relativeY / charHeight);
    const scrolledY = Math.floor(scrollOffsetRef.current / charHeight);

    return asciiClickTargets.some(name => {
      const bounds = namedRawBounds[name];
      if (!bounds) {
        return false;
      }
      const adjustedRow = bounds.fixed ? row : row + scrolledY;
      return col >= bounds.minX && col <= bounds.maxX && adjustedRow >= bounds.minY && adjustedRow <= bounds.maxY;
    });
  }, [asciiClickTargets, hasAsciiClickHandlers, isWhiteInActive, isWhiteoutActive, namedRawBounds]);

  // Track URL changes and trigger white-in effect when needed
  useEffect(() => {
    // Check if URL has changed since last render
    const currentUrl = window.location.href;
    if (currentUrl !== contentStateRef.current.pageUrl) {
      // URL changed, we need a new white-in effect
      contentStateRef.current = {
        whiteInStarted: false,
        pageUrl: currentUrl,
        needsWhiteIn: true
      };
      
      // Reset content loaded state
      if (contentLoaded) {
        setContentLoaded(false);
      }
    }
  }, [contentLoaded]);

  // Define updateLinkOverlays function stub for initial use
  const updateLinkOverlaysRef = useRef<() => void>(() => {});
  const overlayUpdateFrameRef = useRef<number | null>(null);

  const scheduleOverlayUpdate = useCallback(() => {
    if (overlayUpdateFrameRef.current !== null) {
      return;
    }

    overlayUpdateFrameRef.current = requestAnimationFrame(() => {
      overlayUpdateFrameRef.current = null;
      updateLinkOverlaysRef.current();
    });
  }, []);

  useEffect(() => {
    return () => {
      if (overlayUpdateFrameRef.current !== null) {
        cancelAnimationFrame(overlayUpdateFrameRef.current);
      }
    };
  }, []);

  // Scrolling - destructure only what we need, pass cursorRef to update scrolling state
  const { 
    scrollOffset, 
    setScrollOffset,
    scrollOffsetRef: scrollingOffsetRef,
    checkScrollChunk, 
    isScrolling, 
    scrollVelocity 
  } = useScrolling(maxScroll, containerRef, () => {
    // Ensure link overlays update after each scroll chunk
    scheduleOverlayUpdate();
  }, cursorRef); // Pass cursorRef to useScrolling

  useEffect(() => {
    if (initialScrollOffset == null || Number.isNaN(initialScrollOffset)) {
      appliedInitialScrollRef.current = null;
      return;
    }

    const clampedOffset = Math.max(0, Math.min(maxScroll, initialScrollOffset));
    const canApply = appliedInitialScrollRef.current === null
      || Math.abs(scrollOffset - appliedInitialScrollRef.current) < 0.1;

    if (!canApply || appliedInitialScrollRef.current === clampedOffset) {
      return;
    }

    appliedInitialScrollRef.current = clampedOffset;
    scrollOffsetRef.current = clampedOffset;
    scrollingOffsetRef.current = clampedOffset;
    scrollVelocity.current = 0;
    isScrolling.current = false;

    if (scrollOffset !== clampedOffset) {
      setScrollOffset(clampedOffset);
    }
  }, [
    initialScrollOffset,
    isScrolling,
    maxScroll,
    scrollOffset,
    scrollVelocity,
    scrollingOffsetRef,
    setScrollOffset
  ]);

  // Update the scrollOffsetRef when scrollOffset changes
  useEffect(() => {
    scrollOffsetRef.current = scrollOffset;
    if (!pauseAnimation && !disableLinks) {
      scheduleOverlayUpdate();
    }
    if (onScrollOffsetChange) {
      onScrollOffsetChange(scrollOffset);
    }
  }, [scrollOffset, scheduleOverlayUpdate, onScrollOffsetChange, pauseAnimation, disableLinks]);

  // Links management
  const { 
    updateLinkOverlays, 
    handleClick 
  } = useLinks(size, textPositionCache, scrollOffsetRef, (position, url) => {
    // Before starting the whiteout, check if we already have an active overlay
    const hasActiveOverlay = Boolean(cursor.whiteOverlay?.active);
    
    if (hasActiveOverlay) {
      // Skip the whiteout animation and navigate directly
      try {
        sessionStorage.setItem('needsWhiteIn', 'true');
        sessionStorage.setItem('lastWhiteInTimestamp', String(Date.now()));
        // Use center position for white-in on next page
        sessionStorage.setItem('whiteInPosition', JSON.stringify({ x: 0, y: 0 }));
      } catch (e) {
        console.warn('Error storing navigation data in sessionStorage', e);
      }
      
      // Navigate after a short delay
      setTimeout(() => {
        window.location.href = url;
      }, 50);
    } else {
      // Normal flow - start whiteout animation
      startWhiteout(position, url);
    }
  }, textRef, isScrolling, disableLinks);

  // Update the ref with the real function
  useEffect(() => {
    updateLinkOverlaysRef.current = updateLinkOverlays;
  }, [updateLinkOverlays]);

  // Track content loading state
  useEffect(() => {
    // Check if there's a pending white-in from sessionStorage
    let needsWhiteInFromSession = false;
    try {
      needsWhiteInFromSession = sessionStorage.getItem('needsWhiteIn') === 'true';
    } catch (e) {
      console.warn('Error accessing sessionStorage', e);
    }

    // If we have content and the blob cache is built
    if (
      Object.keys(textPositionCache.cache).length > 0 && 
      Object.keys(blobGridCache.current.grid).length > 0 && 
      !contentLoaded
    ) {
      // If we're coming from a navigation (detected by sessionStorage),
      // let the useCursor hook handle it
      if (!needsWhiteInFromSession) {
        // Not from navigation, handle it here
        contentStateRef.current.needsWhiteIn = true;
        contentStateRef.current.whiteInStarted = false;
      }
      
      setContentLoaded(true);
    }
  }, [textPositionCache, blobGridCache, contentLoaded]);

  // Track page load events for refresh and initial load
  useEffect(() => {
    const handlePageLoad = () => {
      // Only trigger if we're not already handling a navigation white-in
      try {
        const needsWhiteInFromSession = sessionStorage.getItem('needsWhiteIn') === 'true';
        if (!needsWhiteInFromSession) {
          contentStateRef.current.needsWhiteIn = true;
          contentStateRef.current.whiteInStarted = false;
          setContentLoaded(false);
        }
      } catch {
        // If we can't access sessionStorage, always trigger white-in
        contentStateRef.current.needsWhiteIn = true;
        contentStateRef.current.whiteInStarted = false;
        setContentLoaded(false);
      }
    };

    // Check if the page is already loaded
    if (document.readyState === 'complete') {
      handlePageLoad();
    } else {
      window.addEventListener('load', handlePageLoad);
      return () => window.removeEventListener('load', handlePageLoad);
    }
  }, []);

  // Mark white-in as handled when it's already running (e.g., after navigation)
  useEffect(() => {
    if (cursor.whiteIn?.active && !contentStateRef.current.whiteInStarted) {
      contentStateRef.current.whiteInStarted = true;
      contentStateRef.current.needsWhiteIn = false;
    }
  }, [cursor.whiteIn]);

  // Start white-in effect after everything is loaded (if not handled by useCursor)
  useEffect(() => {
    if (
      contentLoaded && 
      contentStateRef.current.needsWhiteIn && 
      !contentStateRef.current.whiteInStarted && 
      size.width && 
      size.height
    ) {
      // Check if useCursor has already started a white-in from sessionStorage
      let handledBySession = false;
      try {
        // If lastWhiteInTimestamp is recent (within last 500ms), skip our white-in
        const lastTimestamp = sessionStorage.getItem('lastWhiteInTimestamp');
        if (lastTimestamp) {
          const elapsed = Date.now() - Number(lastTimestamp);
          handledBySession = elapsed < 500;
        }
      } catch (e) {
        console.warn('Error checking sessionStorage timestamps', e);
      }

      if (!handledBySession && !cursor.whiteIn?.active) {
        // Mark as started to prevent duplicate effects
        contentStateRef.current.whiteInStarted = true;
        contentStateRef.current.needsWhiteIn = false;
        
        // Small delay to ensure everything is ready
        setTimeout(() => {
          // Determine the position for the white-in effect
          // If cursor is in the window, use its position, otherwise use center
          const position = cursorRef.current.isInWindow 
            ? { ...cursorRef.current.normalized }
            : { x: 0, y: 0 }; // Center of screen
          
          // Start the white-in effect
          startWhiteIn(position);
        }, 100);
      }
    }
  }, [contentLoaded, startWhiteIn, size.width, size.height, cursor.whiteIn]);

  // Handle page visibility changes to trigger white-in when coming back to the page
  useEffect(() => {
    // Keep track of when the page was hidden
    let pageHiddenTime = 0;
    
    const handleVisibilityChange = () => {
      // When page becomes hidden, record the time
      if (document.visibilityState === 'hidden') {
        pageHiddenTime = Date.now();
      }
      
      // When page becomes visible again
      if (document.visibilityState === 'visible') {
        // Calculate how long the page was hidden
        const hiddenDuration = Date.now() - pageHiddenTime;
        
        // If we're becoming visible again after being hidden
        // Get the timestamp of the last white-in
        let lastWhiteInTime = 0;
        
        try {
          const storedTimestamp = sessionStorage.getItem('lastWhiteInTimestamp');
          if (storedTimestamp) {
            lastWhiteInTime = Number(storedTimestamp);
          }
        } catch (e) {
          console.warn('Error reading lastWhiteInTimestamp from sessionStorage', e);
        }
        
        const timeSinceLastWhiteIn = Date.now() - lastWhiteInTime;
        
        // Only trigger a new white-in if:
        // 1. It's been at least 3 seconds since the last one
        // 2. We're not currently in a white-in or whiteout
        // 3. The page has been hidden for at least 5 seconds (indicating user went away)
        if (
          timeSinceLastWhiteIn > 3000 && 
          !cursor.whiteout?.active && 
          !cursor.whiteIn?.active &&
          hiddenDuration > 5000 // Page was hidden for at least 5 seconds
        ) {
          // Store current timestamp to prevent duplicates
          try {
            sessionStorage.setItem('lastWhiteInTimestamp', String(Date.now()));
          } catch (e) {
            console.warn('Error writing to sessionStorage', e);
          }
          
          // Determine position for white-in
          const position = cursorRef.current.isInWindow 
            ? { ...cursorRef.current.normalized }
            : { x: 0, y: 0 }; // Center of screen
            
          // Start white-in effect directly
          startWhiteIn(position);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [cursor.whiteIn, cursor.whiteout, startWhiteIn]);

  // External white-in trigger (e.g. photo mode exit)
  const lastWhiteInTokenRef = useRef<number | null>(null);

  useEffect(() => {
    if (!whiteInRequest) {
      return;
    }
    if (lastWhiteInTokenRef.current === whiteInRequest.token) {
      return;
    }
    lastWhiteInTokenRef.current = whiteInRequest.token;
    startWhiteIn(whiteInRequest.position, { startProgress: whiteInRequest.startProgress });
  }, [startWhiteIn, whiteInRequest]);

  // Character calculation function
  const characterCalculator = useCallback((
    x: number,
    y: number,
    cols: number,
    rows: number,
    aspect: number,
    time: number,
    precomputed: CharacterPrecomputation | null,
    frameSeed: number,
    frameNow: number
  ) => {
    return calculateCharacter(
      x,
      y,
      cols,
      rows,
      aspect,
      time,
      textPositionCache,
      blobGridCache.current,
      cursorRef,
      scrollOffsetRef.current,
      fastSin,
      fastCos,
      precomputed,
      frameSeed,
      frameNow
    );
  }, [textPositionCache, cursorRef, fastSin, fastCos, blobGridCache]);

  // Animation
  useAnimation(
    textRef,
    size,
    characterCalculator,
    scrollOffsetRef,
    textPositionCache,
    isScrolling,
    scrollVelocity,
    linkPositionsRef,
    pauseAnimation
  );

  // Resize handling
  useEffect(() => {
    const handleResize = () => {
      // Use visualViewport if available, fallback to innerWidth/Height
      const width = window.visualViewport?.width ?? window.innerWidth;
      const height = window.visualViewport?.height ?? window.innerHeight;
      updateCharMetricsForViewport(width);
      setSize({ height, width });
    };

    handleResize(); // Initial size

    // Listen to both window resize and visualViewport resize
    window.addEventListener('resize', handleResize);
    const visualViewport = window.visualViewport;
    visualViewport?.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      visualViewport?.removeEventListener('resize', handleResize);
    };
  }, []);

  // Build blob cache when size changes
  useEffect(() => {
    if (size.width && size.height) {
      needsRebuildRef.current = true;
      buildBlobCache(scrollOffsetRef.current);
    }
  }, [size, buildBlobCache]);

  // Rebuild cache when textPositionCache changes
  useEffect(() => {
    if (Object.keys(textPositionCache.cache).length > 0) {
      needsRebuildRef.current = true;
      setTimeout(() => {
        if (needsRebuildRef.current) {
          buildBlobCache(scrollOffsetRef.current);
        }
      }, 0);
    }
  }, [textPositionCache, buildBlobCache]);

  // Rebuild blob cache during scrolling
  useEffect(() => {
    if (pauseAnimation) {
      return;
    }
    checkScrollChunk(() => {
      needsRebuildRef.current = true;

      if (rebuildCacheTimeoutRef.current) {
        clearTimeout(rebuildCacheTimeoutRef.current);
      }

      buildBlobCache(scrollOffset);
      scheduleOverlayUpdate();

      const timeoutDelay = IS_SAFARI ? 140 : 80;
      rebuildCacheTimeoutRef.current = window.setTimeout(() => {
        if (needsRebuildRef.current) {
          buildBlobCache(scrollOffset);
          scheduleOverlayUpdate();
        }
      }, timeoutDelay);
    });
  }, [scrollOffset, buildBlobCache, checkScrollChunk, scheduleOverlayUpdate, pauseAnimation]);

  useEffect(() => {
    if (!pauseAnimation) {
      needsRebuildRef.current = true;
      buildBlobCache(scrollOffsetRef.current);
      scheduleOverlayUpdate();
    }
  }, [buildBlobCache, pauseAnimation, scheduleOverlayUpdate]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rebuildCacheTimeoutRef.current) {
        clearTimeout(rebuildCacheTimeoutRef.current);
      }
    };
  }, []);

  // Add event listeners for navigation and clicks
  useEffect(() => {
    if (!containerRef.current || disableLinks) return;

    const preventDefaultLinkBehavior = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target && target.closest('[data-link-overlay="true"]')) {
        e.preventDefault();
      }
    };

    const clickHandler = (e: MouseEvent) => {
      handleClick(e);
    };

    const element = containerRef.current;
    element.addEventListener('click', clickHandler, { capture: true });
    document.addEventListener('click', preventDefaultLinkBehavior, { capture: true });

    return () => {
      element.removeEventListener('click', clickHandler, { capture: true });
      document.removeEventListener('click', preventDefaultLinkBehavior, { capture: true });
    };
  }, [handleClick, maxScroll, size, textRef, maxScrollHeight, disableLinks]);

  useEffect(() => {
    if (!containerRef.current || !hasAsciiClickHandlers) {
      return;
    }

    const resolveNormalizedPosition = (clientX: number, clientY: number) => {
      const rect = textRef.current?.getBoundingClientRect();
      const width = rect?.width || window.innerWidth;
      const height = rect?.height || window.innerHeight;
      const left = rect?.left ?? 0;
      const top = rect?.top ?? 0;
      const normalizedX = width ? ((clientX - left) / width) * 2 - 1 : 0;
      const normalizedY = height ? ((clientY - top) / height) * 2 - 1 : 0;
      return { x: normalizedX, y: normalizedY };
    };

    const triggerAsciiClick = (clientX: number, clientY: number) => {
      const normalized = resolveNormalizedPosition(clientX, clientY);
      onAsciiClickStart?.(normalized);
      startWhiteout(normalized, undefined, {
        allowWhiteOverlay: false,
        onComplete: () => onAsciiClickComplete?.(normalized)
      });
    };

    const handleAsciiClick = (e: MouseEvent) => {
      if (!isAsciiClickTarget(e.clientX, e.clientY, e.target)) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      triggerAsciiClick(e.clientX, e.clientY);
    };

    const handleAsciiTouch = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        return;
      }
      if (!isAsciiClickTarget(e.touches[0].clientX, e.touches[0].clientY, e.target)) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      const touch = e.touches[0];
      triggerAsciiClick(touch.clientX, touch.clientY);
    };

    const element = containerRef.current;
    element.addEventListener('click', handleAsciiClick, { capture: true });
    element.addEventListener('touchstart', handleAsciiTouch, { capture: true, passive: false });

    return () => {
      element.removeEventListener('click', handleAsciiClick, { capture: true });
      element.removeEventListener('touchstart', handleAsciiTouch, { capture: true });
    };
  }, [hasAsciiClickHandlers, isAsciiClickTarget, onAsciiClickComplete, onAsciiClickStart, startWhiteout]);

  useEffect(() => {
    if (!containerRef.current || !hasAsciiClickHandlers) {
      setIsAsciiClickHovered(false);
      return;
    }

    const element = containerRef.current;

    const handleMouseMove = (e: MouseEvent) => {
      const nextHover = isAsciiClickTarget(e.clientX, e.clientY, e.target);
      setIsAsciiClickHovered(prev => (prev === nextHover ? prev : nextHover));
    };

    const handleMouseLeave = () => {
      setIsAsciiClickHovered(false);
    };

    element.addEventListener('mousemove', handleMouseMove);
    element.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      element.removeEventListener('mousemove', handleMouseMove);
      element.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [hasAsciiClickHandlers, isAsciiClickTarget]);

  // Update link overlays
  useEffect(() => {
    scheduleOverlayUpdate();
  }, [linkPositions, scrollOffset, scheduleOverlayUpdate]);

  // Ensure link overlays stay aligned after global scroll/resize events
  useEffect(() => {
    const handleSchedule = () => {
      scheduleOverlayUpdate();
    };

    window.addEventListener('scroll', handleSchedule, { passive: true });
    document.addEventListener('scroll', handleSchedule, { passive: true });

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        scheduleOverlayUpdate();
      });
      resizeObserver.observe(containerRef.current);
    }

    const viewport = window.visualViewport;
    const handleViewportResize = () => scheduleOverlayUpdate();
    viewport?.addEventListener('resize', handleViewportResize);

    const textElement = textRef.current;
    textElement?.addEventListener('scroll', handleSchedule, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleSchedule);
      document.removeEventListener('scroll', handleSchedule);
      textElement?.removeEventListener('scroll', handleSchedule);
      resizeObserver?.disconnect();
      viewport?.removeEventListener('resize', handleViewportResize);
    };
  }, [scheduleOverlayUpdate]);

  // Make sure link position updates happen after scroll offset changes
  useEffect(() => {
    scheduleOverlayUpdate();
  }, [scrollOffset, scheduleOverlayUpdate]);

  // Log the Safari offset parameters when they change
  useEffect(() => {
    if (IS_SAFARI) {
      console.log(`Safari link offset parameters: base=${SAFARI_LINK_OFFSET_BASE}px, factor=${SAFARI_LINK_OFFSET_FACTOR}`);
    }
  }, []);

  // Create direct click handler on the container
  useEffect(() => {
    if (!containerRef.current || disableLinks) return;
    
    const handleContainerClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // Check if this is a link click by finding data attributes
      const findLinkUrl = (element: HTMLElement | null): string | null => {
        if (!element) return null;
        
        // Check element attributes directly
        if (element.hasAttribute('data-url')) return element.getAttribute('data-url');
        if (element.hasAttribute('data-href')) return element.getAttribute('data-href');
        if (element.tagName === 'A' && element.hasAttribute('href')) return element.getAttribute('href');
        
        // Check data-link-overlay
        if (element.hasAttribute('data-link-overlay')) {
          const url = element.getAttribute('data-url') || element.getAttribute('data-href');
          if (url) return url;
        }
        
        // Try to find the closest overlay
        const overlay = element.closest('[data-link-overlay="true"]');
        if (overlay) {
          return overlay.getAttribute('data-url') || overlay.getAttribute('data-href');
        }
        
        return null;
      };
      
      const url = findLinkUrl(target);
      if (url) {
        // Found a link - handle the click
        e.preventDefault();
        e.stopPropagation();
        
        console.log('Container click handler found link:', url);
        
        // Calculate normalized click position
        const rect = containerRef.current!.getBoundingClientRect();
        const normalizedX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const normalizedY = ((e.clientY - rect.top) / rect.height) * 2 - 1;
        
        startWhiteout({ x: normalizedX, y: normalizedY }, url);
      }
    };
    
    containerRef.current.addEventListener('click', handleContainerClick);
    
    return () => {
      if (containerRef.current) {
        containerRef.current.removeEventListener('click', handleContainerClick);
      }
    };
  }, [startWhiteout, disableLinks]);

  // Ensure the pre element always covers the viewport (Safari can shrink visualViewport)
  const preHeightPx = (() => {
    const viewport = typeof window !== 'undefined' ? Math.max(window.innerHeight, window.visualViewport?.height ?? 0) : 0;
    const baseHeight = size.height ?? viewport;
    return Math.max(baseHeight, viewport) + CHAR_HEIGHT * 2; // add buffer to avoid bottom gap
  })();
  const asciiClickCursor = hasAsciiClickHandlers && isAsciiClickHovered ? 'pointer' : 'default';

  return (
    <div
      ref={setContainerRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100vh',
        margin: 0,
        padding: 0,
        overflow: 'hidden',
        pointerEvents: (cursor.whiteout?.active || cursor.whiteIn?.active) ? 'none' : 'auto',
        transition: 'opacity 0.1s',
        opacity: 1,
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'manipulation',
        WebkitTapHighlightColor: 'rgba(0,0,0,0)',
        WebkitTouchCallout: 'none'
      }}
    >
      {/* Global style to hide link underlines during effects */}
      {(cursor.whiteout?.active || cursor.whiteIn?.active) && (
        <style dangerouslySetInnerHTML={{ __html: `
          a, a:link, a:visited, a:hover, a:active {
            text-decoration: none !important;
            border-bottom: none !important;
            box-shadow: none !important;
            background: transparent !important;
            color: transparent !important;
          }
        `}} />
      )}
      
      {/* Add debug styles for link overlays if debug mode is enabled */}
      {DEBUG_LINK_OVERLAYS && (
        <style dangerouslySetInnerHTML={{ __html: `
          [data-link-overlay="true"] {
            background-color: rgba(255, 0, 0, 0.3) !important;
            border: 2px solid red !important;
            z-index: 9999 !important;
          }
          
          /* Safari-specific debug styles */
          ${IS_SAFARI ? `
          [data-link-overlay="true"] {
            background-color: rgba(0, 255, 0, 0.5) !important;
            border: 3px solid lime !important;
          }
          ` : ''}
        `}} />
      )}
      
      <pre
        ref={textRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          margin: 0,
          padding: 0,
          overflow: 'hidden',
          whiteSpace: 'pre',
          backgroundColor: transparentBackground ? 'transparent' : 'white',
          color: 'black',
          fontSize: `${SCALE_FACTOR}px`,
          lineHeight: `${SCALE_FACTOR}px`,
          fontFamily: 'monospace',
          letterSpacing: 0,
          marginLeft: '-1px',
          width: 'calc(100% + 2px)',
          height: preHeightPx ? `${preHeightPx}px` : '100vh',
          cursor: (isWhiteoutActive || isWhiteInActive) ? 'default' : asciiClickCursor,
          transform: `translateY(0)`,
          willChange: 'transform',
          backfaceVisibility: 'hidden',
          pointerEvents: (cursor.whiteout?.active || cursor.whiteIn?.active) ? 'none' : 'auto',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          zIndex: 1
        }}
        dangerouslySetInnerHTML={{ __html: '' }}
      />
      
      {/* Invisible clickable link overlays */}
      {!disableLinks && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none', // Allow clicks to pass through to links
            zIndex: 2000, // Very high z-index to ensure it's above other elements
            willChange: 'transform'
          }}
        >
          {linkPositions.map((link, index) => {
            // Get fixed status from textPositionCache
            const isFixed = textPositionCache.bounds[link.textKey]?.fixed || false;
            
            // Calculate position with explicit scroll adjustment
            const actualScrollY = Math.floor(scrollOffset / CHAR_HEIGHT);
            const linkY = isFixed ? link.y : link.y - actualScrollY;
            
            // Calculate Safari-specific offset correction that increases proportionally with scroll depth
            // This fixes the increasing misalignment issue in Safari
            let safariOffsetCorrection = 0;
            if (IS_SAFARI && !isFixed) {
              // Apply proportional offset based on scroll position
              safariOffsetCorrection = SAFARI_LINK_OFFSET_BASE + (actualScrollY * SAFARI_LINK_OFFSET_FACTOR);
            }
            
            // Extreme visibility buffer to ensure links are rendered
            const visibilityBuffer = 50;
            if (linkY >= -visibilityBuffer && 
                linkY < (size.height || 0) / CHAR_HEIGHT + visibilityBuffer) {
              
              // Calculate position with very wide margins for easier clicking
              const margin = Math.ceil(CHAR_WIDTH * 3.0); // Extremely generous margin
              const left = Math.max(0, Math.floor(link.startX * CHAR_WIDTH) - margin);
              const width = Math.ceil((link.endX - link.startX + 1) * CHAR_WIDTH) + (margin * 2);
              
              // Much larger hit area for vertical positioning - increased for mobile
              const verticalOffset = Math.ceil(CHAR_HEIGHT * 2.0);
              // Apply the Safari offset correction to the top position
              const top = Math.floor(linkY * CHAR_HEIGHT) - verticalOffset - safariOffsetCorrection;
              const height = Math.ceil(CHAR_HEIGHT * 8); // Very large height for better hit detection on mobile
              
                return (
                  <div 
                    key={`link-${index}-${link.url}-${linkY}`}
                    data-href={link.url}
                    data-link-overlay="true"
                    data-url={link.url}
                    data-fixed={isFixed ? "true" : "false"}
                    data-text-key={link.textKey}
                    data-y-pos={linkY.toString()}
                    data-orig-y={link.y.toString()}
                    data-scroll-y={actualScrollY.toString()}
                    data-safari-offset={safariOffsetCorrection.toString()}
                    style={{
                      position: 'absolute',
                      left: `${left}px`,
                      top: `${top}px`,
                      width: `${width}px`,
                      height: `${height}px`,
                      backgroundColor: DEBUG_LINK_OVERLAYS ? 'rgba(255, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0)', // Show overlay in debug mode
                      border: DEBUG_LINK_OVERLAYS ? '1px solid red' : 'none',
                      pointerEvents: 'auto', // Explicitly enable pointer events
                      zIndex: index === hoveredLinkIndex ? 3000 : 2500, // Hovered link gets higher z-index
                      cursor: 'pointer',
                      display: 'block',
                      color: 'transparent',
                      transform: 'translateZ(0)', // Force GPU acceleration
                      willChange: 'transform',
                      // Add important rules to ensure clickability
                      userSelect: 'none',
                      touchAction: 'manipulation',
                      WebkitTapHighlightColor: 'rgba(0,0,0,0)',
                      WebkitTouchCallout: 'none'
                    }}
                    onMouseEnter={() => setHoveredLinkIndex(index)}
                    onMouseLeave={() => setHoveredLinkIndex(null)}
                    onClick={e => {
                      // Immediately stop event propagation
                      e.preventDefault();
                      e.stopPropagation();
                      (e.nativeEvent as MouseEvent).stopImmediatePropagation();
                      
                      const rect = textRef.current!.getBoundingClientRect();
                      const clickX = e.clientX - rect.left;
                      const clickY = e.clientY - rect.top;
                      
                      // Find the closest link based on actual text position (proximity-based)
                      const currentScrollY = Math.floor(scrollOffset / CHAR_HEIGHT);
                      let closestLink = link;
                      let closestDistance = Infinity;
                      
                      for (const candidateLink of linkPositions) {
                        const candidateIsFixed = textPositionCache.bounds[candidateLink.textKey]?.fixed || false;
                        const candidateLinkY = candidateIsFixed ? candidateLink.y : candidateLink.y - currentScrollY;
                        
                        // Calculate actual text center position in pixels
                        const textCenterX = ((candidateLink.startX + candidateLink.endX) / 2) * CHAR_WIDTH;
                        const textCenterY = candidateLinkY * CHAR_HEIGHT + CHAR_HEIGHT / 2;
                        
                        // Calculate distance from click to text center
                        const dx = clickX - textCenterX;
                        const dy = clickY - textCenterY;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        
                        if (distance < closestDistance) {
                          closestDistance = distance;
                          closestLink = candidateLink;
                        }
                      }
                      
                      console.log(`Proximity click: closest link is ${closestLink.url} (distance: ${closestDistance.toFixed(1)}px)`);
                      
                      const normalizedX = (clickX / (size.width || 1)) * 2 - 1;
                      const normalizedY = (clickY / (size.height || 1)) * 2 - 1;
                      
                      startWhiteout({ x: normalizedX, y: normalizedY }, closestLink.url);
                    }}
                    onTouchStart={e => {
                      e.preventDefault();
                      
                      const touch = e.touches[0];
                      const rect = textRef.current!.getBoundingClientRect();
                      const touchX = touch.clientX - rect.left;
                      const touchY = touch.clientY - rect.top;
                      
                      // Find the closest link based on actual text position (proximity-based)
                      const currentScrollY = Math.floor(scrollOffset / CHAR_HEIGHT);
                      let closestLink = link;
                      let closestDistance = Infinity;
                      
                      for (const candidateLink of linkPositions) {
                        const candidateIsFixed = textPositionCache.bounds[candidateLink.textKey]?.fixed || false;
                        const candidateLinkY = candidateIsFixed ? candidateLink.y : candidateLink.y - currentScrollY;
                        
                        // Calculate actual text center position in pixels
                        const textCenterX = ((candidateLink.startX + candidateLink.endX) / 2) * CHAR_WIDTH;
                        const textCenterY = candidateLinkY * CHAR_HEIGHT + CHAR_HEIGHT / 2;
                        
                        // Calculate distance from touch to text center
                        const dx = touchX - textCenterX;
                        const dy = touchY - textCenterY;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        
                        if (distance < closestDistance) {
                          closestDistance = distance;
                          closestLink = candidateLink;
                        }
                      }
                      
                      console.log(`Proximity touch: closest link is ${closestLink.url} (distance: ${closestDistance.toFixed(1)}px)`);
                      
                      const normalizedX = (touchX / (size.width || 1)) * 2 - 1;
                      const normalizedY = (touchY / (size.height || 1)) * 2 - 1;
                      
                      startWhiteout({ x: normalizedX, y: normalizedY }, closestLink.url);
                    }}
                  title={link.url}
                />
              );
            }
            return null;
          })}
        </div>
      )}
    </div>
  );
};

export default AsciiArtGenerator;
