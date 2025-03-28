import React, { useRef, useState, useEffect, useCallback } from 'react';
import { AsciiArtGeneratorProps, Size, LinkPosition } from './types';
import { SCALE_FACTOR, CHAR_HEIGHT, CHAR_WIDTH } from './constants';
import { createSinTable, createCosTable, createFastSin, createFastCos } from './utils';
import { 
  useTextPositioning,
  useBlobCache,
  useScrolling,
  useCursor,
  useLinks,
  useContentHeight,
  useAnimation
} from './hooks';
import { calculateCharacter } from './renderer';

const AsciiArtGenerator: React.FC<AsciiArtGeneratorProps> = ({ textContent, maxScrollHeight }) => {
  const textRef = useRef<HTMLPreElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<Size>({ height: null, width: null });
  const scrollOffsetRef = useRef<number>(0);
  const [contentLoaded, setContentLoaded] = useState(false);
  
  // Use ref to track content state
  const contentStateRef = useRef({
    whiteInStarted: false,
    pageUrl: typeof window !== 'undefined' ? window.location.href : '',
    needsWhiteIn: true
  });

  // Initialize trig tables
  const sinTable = createSinTable();
  const cosTable = createCosTable();
  const fastSin = createFastSin(sinTable);
  const fastCos = createFastCos(cosTable);

  // Link state management - Needs to be declared before useTextPositioning
  const [linkPositions, setLinkPositions] = useState<LinkPosition[]>([]);
  const linkPositionsRef = useRef<LinkPosition[]>([]);

  // Text positioning - Calculate this *before* content height
  const textPositionCache = useTextPositioning(
    textContent,
    size,
    setLinkPositions,
    linkPositionsRef
  );

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

  // Scrolling
  const { 
    scrollOffset, 
    isScrolling, 
    scrollVelocity, 
    checkScrollChunk 
  } = useScrolling(maxScroll, textRef, () => {
    updateLinkOverlaysRef.current();
  });

  // Update the scrollOffsetRef when scrollOffset changes
  useEffect(() => {
    scrollOffsetRef.current = scrollOffset;
  }, [scrollOffset]);

  // Define updateLinkOverlays function stub for initial use
  const updateLinkOverlaysRef = useRef<() => void>(() => {});

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
  });

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
      } catch (e) {
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

  // Character calculation function
  const characterCalculator = useCallback((
    x: number, 
    y: number, 
    cols: number, 
    rows: number, 
    aspect: number, 
    time: number
  ) => {
    return calculateCharacter(
      x, y, cols, rows, aspect, time,
      textPositionCache,
      blobGridCache.current,
      cursorRef,
      scrollOffsetRef.current,
      fastSin,
      fastCos
    );
  }, [textPositionCache, cursorRef, fastSin, fastCos, blobGridCache]);

  // Animation
  const { } = useAnimation(
    textRef,
    size,
    characterCalculator,
    scrollOffsetRef,
    textPositionCache,
    isScrolling,
    scrollVelocity,
    linkPositionsRef
  );

  // Resize handling
  useEffect(() => {
    const handleResize = () => {
      // Use visualViewport if available, fallback to innerWidth/Height
      const width = window.visualViewport?.width ?? window.innerWidth;
      const height = window.visualViewport?.height ?? window.innerHeight;
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
    checkScrollChunk(() => {
      needsRebuildRef.current = true;
      
      if (rebuildCacheTimeoutRef.current) {
        clearTimeout(rebuildCacheTimeoutRef.current);
      }
      
      rebuildCacheTimeoutRef.current = window.setTimeout(() => {
        if (needsRebuildRef.current) {
          buildBlobCache(scrollOffset);
        }
      }, 100);
    });
  }, [scrollOffset, buildBlobCache, checkScrollChunk]);

  // Build blob cache on first render
  useEffect(() => {
    if (!Object.keys(blobGridCache.current.grid).length && size.width && size.height) {
      buildBlobCache(scrollOffsetRef.current);
    }
  }, [buildBlobCache, size, blobGridCache]);

  // Clear blob cache on content changes
  useEffect(() => {
    blobGridCache.current = {
      grid: {},
      startX: 0,
      startY: 0,
      width: 0,
      height: 0
    };
  }, [textContent]);

  // Link event listeners
  useEffect(() => {
    const element = textRef.current;
    if (!element) return;
    
    // Use correct event type for click handling with capture phase
    const clickHandler = (e: MouseEvent) => {
      // Handle click in capture phase to ensure we get it first
      handleClick(e, textRef);
    };
    
    // Use capture phase to get events before they reach links
    element.addEventListener('click', clickHandler, { capture: true });
    
    // Prevent the default behavior of all links within the component
    const preventDefaultLinkBehavior = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'A' || target.closest('a')) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    
    // Add this listener to the document to catch all link clicks
    document.addEventListener('click', preventDefaultLinkBehavior, { capture: true });
    
    // Update cursor style over links
    const handleMouseMove = (_e: MouseEvent) => {
      if (!element || !size.width || !size.height) return;
      
      // For scrolling areas, we still want to show the appropriate cursor
      const maxScroll = maxScrollHeight ? Math.max(0, maxScrollHeight - (size.height || 0)) : 0;
      
      // Default cursor for scrollable areas
      if (maxScroll > 0) {
        element.style.cursor = 'ns-resize';
      } else {
        element.style.cursor = 'default';
      }
    };
    
    element.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      element.removeEventListener('click', clickHandler, { capture: true });
      document.removeEventListener('click', preventDefaultLinkBehavior, { capture: true });
      element.removeEventListener('mousemove', handleMouseMove);
    };
  }, [handleClick, maxScroll, size, textRef, maxScrollHeight]);

  // Update link overlays
  useEffect(() => {
    updateLinkOverlays();
  }, [linkPositions, scrollOffset, updateLinkOverlays]);

  return (
    <div 
      ref={containerRef}
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
          backgroundColor: 'white',
          color: 'black',
          fontSize: `${SCALE_FACTOR}px`,
          lineHeight: `${SCALE_FACTOR}px`,
          fontFamily: 'monospace',
          letterSpacing: 0,
          marginLeft: '-1px',
          width: 'calc(100% + 2px)',
          height: size.height ? `${size.height}px` : '100vh',
          cursor: (cursor.whiteout?.active || cursor.whiteIn?.active) ? 'default' : (maxScroll > 0 ? 'ns-resize' : 'default'),
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
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 100
        }}
      >
        {linkPositions.map((link, index) => {
          // Calculate position with scrolling adjustment
          const isFixed = textPositionCache.bounds[link.textKey]?.fixed || false;
          const linkY = isFixed ? link.y : link.y - Math.floor(scrollOffset / CHAR_HEIGHT);
          
          // Only render if potentially visible
          if (linkY >= -10 && linkY < (size.height || 0) / CHAR_HEIGHT + 10) {
            // Calculate position with wide margins for easier clicking
            const margin = Math.ceil(CHAR_WIDTH * 1.2);
            const left = Math.max(0, Math.floor(link.startX * CHAR_WIDTH) - margin);
            const width = Math.ceil((link.endX - link.startX + 1) * CHAR_WIDTH) + (margin * 2);
            const top = Math.floor(linkY * CHAR_HEIGHT) - Math.ceil(CHAR_HEIGHT * 1.5);
            const height = Math.ceil(CHAR_HEIGHT * 4);
            
            return (
              <div 
                key={`link-${index}`}
                data-href={link.url}
                data-link-overlay="true"
                style={{
                  position: 'absolute',
                  left: `${left}px`,
                  top: `${top}px`,
                  width: `${width}px`,
                  height: `${height}px`,
                  backgroundColor: 'transparent',
                  border: 'none',
                  pointerEvents: 'auto',
                  zIndex: 1000,
                  cursor: 'pointer',
                  display: 'block',
                  color: 'transparent'
                }}
                onClick={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  
                  // Use whiteout effect instead of direct navigation
                  const rect = textRef.current!.getBoundingClientRect();
                  const relativeX = e.clientX - rect.left;
                  const relativeY = e.clientY - rect.top;
                  
                  const normalizedX = (relativeX / (size.width || 1)) * 2 - 1;
                  const normalizedY = (relativeY / (size.height || 1)) * 2 - 1;
                  
                  startWhiteout({ x: normalizedX, y: normalizedY }, link.url);
                }}
                title={link.url}
              />
            );
          }
          return null;
        })}
      </div>
    </div>
  );
};

export default AsciiArtGenerator; 