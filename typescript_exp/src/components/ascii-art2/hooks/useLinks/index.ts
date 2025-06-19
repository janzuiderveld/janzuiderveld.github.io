import { useState, useRef, useCallback, useEffect } from 'react';
import { LinkPosition, LinkOverlay } from '../../types';
import { UseLinksParams, UseLinksResult } from './types';
import { createLinkOverlays } from './overlayManagement';
import { handleDocumentClick, handleDocumentTouch } from './eventHandlers';

export const useLinks = ({
  size,
  textPositionCache,
  scrollOffsetRef,
  startWhiteout
}: UseLinksParams): UseLinksResult => {
  const [linkPositions, setLinkPositions] = useState<LinkPosition[]>([]);
  const linkPositionsRef = useRef<LinkPosition[]>([]);
  const [linkClicked] = useState<string | null>(null);
  const [linkOverlays, setLinkOverlays] = useState<LinkOverlay[]>([]);
  const lastScrollOffsetRef = useRef(scrollOffsetRef.current);
  const isScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<number | null>(null);

  // Enhanced scroll tracking
  useEffect(() => {
    // Track scroll changes and set scrolling state
    const handleScroll = () => {
      // If scroll position changed, mark as scrolling
      if (lastScrollOffsetRef.current !== scrollOffsetRef.current) {
        isScrollingRef.current = true;
        
        // Clear any existing timeout
        if (scrollTimeoutRef.current !== null) {
          window.clearTimeout(scrollTimeoutRef.current);
        }
        
        // Set timeout to mark scrolling as complete after a short delay
        scrollTimeoutRef.current = window.setTimeout(() => {
          isScrollingRef.current = false;
          // Update link overlays after scrolling stops
          requestAnimationFrame(() => updateLinkOverlays());
        }, 150);
      }
      
      lastScrollOffsetRef.current = scrollOffsetRef.current;
    };
    
    // Check for scroll changes frequently
    const interval = setInterval(handleScroll, 50);
    
    return () => {
      clearInterval(interval);
      if (scrollTimeoutRef.current !== null) {
        window.clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Update link overlays with improved positioning
  const updateLinkOverlays = useCallback(() => {
    const newOverlays = createLinkOverlays(
      size,
      linkPositionsRef.current,
      scrollOffsetRef.current,
      textPositionCache
    );
    
    setLinkOverlays(newOverlays);
  }, [size, scrollOffsetRef, textPositionCache]);

  // Initialize and update link positions and overlays when text content changes
  useEffect(() => {
    linkPositionsRef.current = textPositionCache.links;
    setLinkPositions(textPositionCache.links);
    updateLinkOverlays();
  }, [textPositionCache.links, updateLinkOverlays]);

  // Add direct DOM event listeners for link detection
  useEffect(() => {
    // Set up document click handler for link detection
    const documentClickHandler = (e: MouseEvent) => handleDocumentClick(e, startWhiteout);
    
    // Set up document touch handler for link detection on mobile
    const documentTouchHandler = (e: TouchEvent) => handleDocumentTouch(e, startWhiteout);
    
    // Add event listeners
    document.addEventListener('click', documentClickHandler, { capture: true });
    document.addEventListener('touchstart', documentTouchHandler, { capture: true, passive: false });
    
    // Cleanup on unmount
    return () => {
      document.removeEventListener('click', documentClickHandler, { capture: true });
      document.removeEventListener('touchstart', documentTouchHandler, { capture: true });
    };
  }, [startWhiteout]);

  // Update link overlays when window is resized
  useEffect(() => {
    const handleResize = () => {
      requestAnimationFrame(() => updateLinkOverlays());
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [updateLinkOverlays]);

  return {
    linkPositions,
    linkPositionsRef,
    linkClicked,
    linkOverlays,
    updateLinkOverlays
  };
};

export * from './types';
export * from './overlayManagement';
export * from './eventHandlers'; 