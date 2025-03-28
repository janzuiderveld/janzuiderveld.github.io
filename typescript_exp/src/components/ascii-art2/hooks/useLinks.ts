import { useState, useRef, useCallback } from 'react';
import { 
  CHAR_WIDTH, 
  CHAR_HEIGHT, 
  SAFARI_LINK_Y_OFFSET, 
  SAFARI_CURSOR_Y_OFFSET, 
  IS_SAFARI 
} from '../constants';
import { LinkPosition, LinkOverlay, Size, TextPositionCacheResult } from '../types';

export const useLinks = (
  size: Size,
  textPositionCache: TextPositionCacheResult,
  scrollOffsetRef: React.MutableRefObject<number>,
  startWhiteout: (position: { x: number; y: number }, targetUrl: string) => void
) => {
  const [linkPositions, setLinkPositions] = useState<LinkPosition[]>([]);
  const linkPositionsRef = useRef<LinkPosition[]>([]);
  const [linkClicked, setLinkClicked] = useState<string | null>(null);
  const [linkOverlays, setLinkOverlays] = useState<LinkOverlay[]>([]);

  // Update link overlays
  const updateLinkOverlays = useCallback(() => {
    if (!size.width || !size.height) return;
    
    const scrolledY = Math.floor(scrollOffsetRef.current / CHAR_HEIGHT);
    const newOverlays: LinkOverlay[] = [];
    
    for (const link of linkPositionsRef.current) {
      const isFixed = textPositionCache.bounds[link.textKey]?.fixed || false;
      const linkY = isFixed ? link.y : link.y - scrolledY;
      
      // Use a wider range to ensure we catch all links
      if (linkY >= -5 && linkY < (size.height / CHAR_HEIGHT) + 5) {
        // Calculate exact position with pixel precision
        const left = Math.max(0, link.startX * CHAR_WIDTH);
        const top = linkY * CHAR_HEIGHT;
        
        // Don't apply Safari offset for better precision
        const width = (link.endX - link.startX + 1) * CHAR_WIDTH;
        // Make clickable area much taller for better hit detection
        const height = CHAR_HEIGHT * 3; // Consistent larger hit area for all browsers
        
        // Position the overlay directly on the text for debugging
        const adjustedTop = top;
        
        newOverlays.push({
          url: link.url,
          style: {
            position: 'absolute',
            left: `${left}px`,
            top: `${adjustedTop}px`,
            width: `${width}px`,
            height: `${height}px`,
            backgroundColor: 'rgba(255, 0, 0, 0.3)', // Bright red transparent background for debugging
            cursor: 'pointer',
            zIndex: 9999, // Very high z-index to ensure it's above everything
            pointerEvents: 'auto',
            transition: 'none', // Disable transitions for immediate feedback
            outline: 'none',
            display: 'block',
            padding: 0,
            margin: 0,
            boxSizing: 'border-box',
            border: '2px solid red', // Very visible red border
            borderRadius: 0, // No rounded corners for exact positioning
            boxShadow: '0 0 5px rgba(255, 0, 0, 0.7)', // Red glow
            userSelect: 'none',
            textAlign: 'center', // Center text
            color: 'white', // White text
            fontWeight: 'bold', // Bold text
            fontSize: '10px', // Small text
            lineHeight: '1.2', // Tight line height
            overflow: 'hidden', // Hide overflow
            whiteSpace: 'nowrap', // Don't wrap text
            textOverflow: 'ellipsis', // Ellipsis for overflow
          }
        });
      }
    }
    
    setLinkOverlays(newOverlays);
  }, [size, textPositionCache.bounds, scrollOffsetRef]);

  // Link click handling
  const handleClick = useCallback((e: MouseEvent, textRef: React.RefObject<HTMLPreElement>) => {
    if (!textRef.current || !size.width || !size.height) return;
    
    console.log("Click detected at:", e.clientX, e.clientY);
    
    // DEBUG: Print all overlays and their positions
    console.log("Current link overlays:", linkPositionsRef.current);
    
    // Check if the click was on an overlay element first (most reliable)
    const target = e.target as HTMLElement;
    
    // Helper function to trigger the whiteout effect
    const triggerWhiteout = (url: string) => {
      console.log('🔗 Link clicked, triggering whiteout to:', url);
      
      // Completely stop event propagation and prevent default behavior
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      
      const rect = textRef.current!.getBoundingClientRect();
      const normalizedX = ((e.clientX - rect.left) / (size.width || 1)) * 2 - 1;
      const normalizedY = ((e.clientY - rect.top) / (size.height || 1)) * 2 - 1;
      
      startWhiteout({ x: normalizedX, y: normalizedY }, url);
      
      // Return false to prevent any other handlers
      return false;
    };
    
    // First check direct target
    if (target.hasAttribute('data-link-overlay') || target.hasAttribute('data-url')) {
      const url = target.getAttribute('data-url');
      if (url) {
        console.log('Link clicked directly on overlay:', url);
        triggerWhiteout(url);
        return;
      }
    }
    
    // Check if it's our "CLICK HERE" explicit link
    if (target.tagName === 'A' && target.getAttribute('href')) {
      console.log('Link clicked via explicit link element:', target.getAttribute('href'));
      const href = target.getAttribute('href');
      if (href) {
        e.preventDefault();
        triggerWhiteout(href);
      }
      return;
    }
    
    // Then check for closest overlay
    const linkOverlay = target.closest('[data-link-overlay="true"]');
    if (linkOverlay) {
      const url = linkOverlay.getAttribute('data-url');
      if (url) {
        console.log('Link clicked via overlay container:', url);
        triggerWhiteout(url);
        return;
      }
    }
    
    // Fallback detection directly via coordinates - more lenient for debugging
    const rect = textRef.current.getBoundingClientRect();
    const relativeX = e.clientX - rect.left;
    const relativeY = e.clientY - rect.top; 
    
    console.log("Click coordinates relative to text:", relativeX, relativeY);
    
    const gridX = Math.floor(relativeX / CHAR_WIDTH);
    const gridY = Math.floor(relativeY / CHAR_HEIGHT);
    
    // Adjust for scroll position
    const scrolledY = Math.floor(scrollOffsetRef.current / CHAR_HEIGHT);
    const adjustedGridY = gridY + scrolledY;
    
    console.log("Grid coordinates:", gridX, gridY, "Adjusted for scroll:", gridX, adjustedGridY);
    
    // Use an extremely forgiving hit detection area for debugging
    const hitSlop = 5;
    
    // Check if click is on a link with very forgiving boundaries
    for (const link of linkPositionsRef.current) {
      const isFixed = textPositionCache.bounds[link.textKey]?.fixed || false;
      const linkY = isFixed ? link.y : link.y - scrolledY;
      
      console.log(`Testing link ${link.url} at pos:`, link.startX, linkY, "to", link.endX, linkY);
      
      // Use a larger hit detection range
      if (gridX >= link.startX - hitSlop && 
          gridX <= link.endX + hitSlop && 
          Math.abs(gridY - linkY) <= hitSlop) {
        console.log('Link detected via coordinate check:', link.url);
        
        const normalizedX = (relativeX / (size.width || 1)) * 2 - 1;
        const normalizedY = (relativeY / (size.height || 1)) * 2 - 1;
        
        triggerWhiteout(link.url);
        return;
      }
    }
    
    console.log("No link found at click position");
  }, [size, textPositionCache.bounds, scrollOffsetRef, startWhiteout]);

  return {
    linkPositions,
    setLinkPositions,
    linkPositionsRef,
    linkClicked,
    setLinkClicked,
    linkOverlays,
    updateLinkOverlays,
    handleClick
  };
}; 