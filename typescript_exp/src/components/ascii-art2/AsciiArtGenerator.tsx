import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { AsciiArtGeneratorProps, Size, LinkPosition } from './types';
import { 
  SCALE_FACTOR, 
  CHAR_HEIGHT, 
  CHAR_WIDTH, 
  IS_SAFARI, 
  SAFARI_LINK_OFFSET_BASE, 
  SAFARI_LINK_OFFSET_FACTOR,
  DEBUG_LINK_OVERLAYS
} from './constants';
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
import { calculateCharacter, CharacterPrecomputation } from './renderer';

const AsciiArtGenerator: React.FC<AsciiArtGeneratorProps> = ({ 
  textContent, 
  maxScrollHeight,
  onScrollOffsetChange
}) => {
  // Log Safari detection status for debugging
  // console.log(`Browser detection - IS_SAFARI: ${IS_SAFARI}`, navigator.userAgent);
  
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
    checkScrollChunk, 
    isScrolling, 
    scrollVelocity 
  } = useScrolling(maxScroll, containerRef, () => {
    // Ensure link overlays update after each scroll chunk
    scheduleOverlayUpdate();
  }, cursorRef); // Pass cursorRef to useScrolling

  // Update the scrollOffsetRef when scrollOffset changes
  useEffect(() => {
    scrollOffsetRef.current = scrollOffset;
    scheduleOverlayUpdate();
    if (onScrollOffsetChange) {
      onScrollOffsetChange(scrollOffset);
    }
  }, [scrollOffset, scheduleOverlayUpdate, onScrollOffsetChange]);

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
  }, isScrolling);

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
  }, [scrollOffset, buildBlobCache, checkScrollChunk, scheduleOverlayUpdate]);

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
    if (!containerRef.current) return;

    const preventDefaultLinkBehavior = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target && target.closest('[data-link-overlay="true"]')) {
        e.preventDefault();
      }
    };

    const clickHandler = (e: MouseEvent) => {
      handleClick(e, textRef);
    };

    const element = containerRef.current;
    element.addEventListener('click', clickHandler, { capture: true });
    document.addEventListener('click', preventDefaultLinkBehavior, { capture: true });

    return () => {
      element.removeEventListener('click', clickHandler, { capture: true });
      document.removeEventListener('click', preventDefaultLinkBehavior, { capture: true });
    };
  }, [handleClick, maxScroll, size, textRef, maxScrollHeight]);

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
    if (!containerRef.current) return;
    
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
  }, [startWhiteout]);

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
                  zIndex: 2500, // Even higher z-index than the container
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
                onClick={e => {
                  // Immediately stop event propagation
                  e.preventDefault();
                  e.stopPropagation();
                  // Cast to native MouseEvent to access stopImmediatePropagation
                  (e.nativeEvent as MouseEvent).stopImmediatePropagation();
                  
                  // Log debug info with more details about positioning
                  console.log(`Clicked link: ${link.url}, Fixed: ${isFixed}, TextKey: ${link.textKey}`);
                  console.log(`Link Y: ${linkY}, Original Y: ${link.y}, Scroll Y: ${actualScrollY}`);
                  if (IS_SAFARI) {
                    console.log(`Safari offset correction: ${safariOffsetCorrection}px`);
                  }
                  
                  // Use whiteout effect instead of direct navigation
                  const rect = textRef.current!.getBoundingClientRect();
                  const relativeX = e.clientX - rect.left;
                  const relativeY = e.clientY - rect.top;
                  
                  const normalizedX = (relativeX / (size.width || 1)) * 2 - 1;
                  const normalizedY = (relativeY / (size.height || 1)) * 2 - 1;
                  
                  startWhiteout({ x: normalizedX, y: normalizedY }, link.url);
                }}
                onTouchStart={e => {
                  // Prevent default to avoid delays
                  e.preventDefault();
                  
                  // Log touch debug info
                  console.log(`Touch started on link: ${link.url}`);
                  
                  // Get touch position
                  const touch = e.touches[0];
                  const rect = textRef.current!.getBoundingClientRect();
                  const relativeX = touch.clientX - rect.left;
                  const relativeY = touch.clientY - rect.top;
                  
                  const normalizedX = (relativeX / (size.width || 1)) * 2 - 1;
                  const normalizedY = (relativeY / (size.height || 1)) * 2 - 1;
                  
                  // Immediately trigger the whiteout on touch start
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
