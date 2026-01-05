import { useState, useRef, useCallback, useEffect } from 'react';
import { 
  CHAR_WIDTH, 
  CHAR_HEIGHT, 
  // SAFARI_LINK_Y_OFFSET, // Removed
  // SAFARI_CURSOR_Y_OFFSET, // Removed
  IS_SAFARI,
  SAFARI_LINK_OFFSET_BASE,
  SAFARI_LINK_OFFSET_FACTOR
} from '../constants';
import { LinkPosition, Size, TextPositionCacheResult } from '../types';

export const useLinks = (
  size: Size,
  textPositionCache: TextPositionCacheResult,
  scrollOffsetRef: React.MutableRefObject<number>,
  startWhiteout: (position: { x: number; y: number }, targetUrl: string) => void,
  textRef: React.RefObject<HTMLPreElement>,
  externalScrollingRef?: React.MutableRefObject<boolean>,
  disabled: boolean = false
) => {
  const linkPositionsRef = useRef<LinkPosition[]>([]);
  const [, setOverlayRevision] = useState(0);
  const internalScrollingRef = useRef(false);
  const isScrollingRef = externalScrollingRef ?? internalScrollingRef;

  const calculateSafariOffset = useCallback((scrollY: number, isFixed: boolean): number => {
    if (!IS_SAFARI || isFixed) return 0;
    return SAFARI_LINK_OFFSET_BASE + (scrollY * SAFARI_LINK_OFFSET_FACTOR);
  }, []);

  const resolveClosestLink = useCallback((clientX: number, clientY: number) => {
    if (!textRef.current || !size.width || !size.height) {
      return null;
    }

    const rect = textRef.current.getBoundingClientRect();
    const relativeX = clientX - rect.left;
    const relativeY = clientY - rect.top;
    const scrolledY = Math.floor(scrollOffsetRef.current / CHAR_HEIGHT);

    // Match overlay geometry so the proximity selection uses the same hit areas
    const margin = Math.ceil(CHAR_WIDTH * 3.0);
    const verticalOffset = Math.ceil(CHAR_HEIGHT * 2.0);
    const hitHeight = Math.ceil(CHAR_HEIGHT * 8);

    let closest: { link: LinkPosition; distance: number } | null = null;

    for (const link of linkPositionsRef.current) {
      const isFixed = textPositionCache.bounds[link.textKey]?.fixed || false;
      const linkY = isFixed ? link.y : link.y - scrolledY;
      const safariOffset = calculateSafariOffset(scrolledY, isFixed);

      const left = Math.max(0, Math.floor(link.startX * CHAR_WIDTH) - margin);
      const width = Math.ceil((link.endX - link.startX + 1) * CHAR_WIDTH) + (margin * 2);
      const top = Math.floor(linkY * CHAR_HEIGHT) - verticalOffset - safariOffset;
      const height = hitHeight;

      const right = left + width;
      const bottom = top + height;
      const withinOverlay = relativeX >= left && relativeX <= right && relativeY >= top && relativeY <= bottom;

      if (!withinOverlay) {
        continue;
      }

      const centerX = ((link.startX + link.endX) / 2) * CHAR_WIDTH;
      const centerY = linkY * CHAR_HEIGHT + (CHAR_HEIGHT / 2);
      const distance = Math.hypot(relativeX - centerX, relativeY - centerY);

      if (!closest || distance < closest.distance) {
        closest = { link, distance };
      }
    }

    if (!closest) {
      return null;
    }

    const normalizedX = (relativeX / rect.width) * 2 - 1;
    const normalizedY = (relativeY / rect.height) * 2 - 1;

    return {
      link: closest.link,
      normalized: { x: normalizedX, y: normalizedY }
    };
  }, [calculateSafariOffset, scrollOffsetRef, size.height, size.width, textPositionCache.bounds, textRef]);

  // Keep the local ref aligned with the most recent link map so coordinate fallback stays accurate
  useEffect(() => {
    if (textPositionCache.links !== linkPositionsRef.current) {
      linkPositionsRef.current = textPositionCache.links;
    }
  }, [textPositionCache.links]);

  // Update link overlays with improved positioning
  const updateLinkOverlays = useCallback(() => {
    if (disabled || !size.width || !size.height) {
      return;
    }

    setOverlayRevision(prev => prev + 1);
  }, [disabled, size.height, size.width]);

  // Add direct DOM event listeners for more reliable click detection
  useEffect(() => {
    if (disabled) {
      return;
    }
    // Function to handle direct click events on the document
    const handleDocumentClick = (e: MouseEvent) => {
      // First try proximity resolution so overlapping overlays choose the nearest link center
      const proximityMatch = resolveClosestLink(e.clientX, e.clientY);
      if (proximityMatch) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        console.log('Direct DOM proximity match:', proximityMatch.link.url);
        startWhiteout(proximityMatch.normalized, proximityMatch.link.url);
        return;
      }

      // Fallback: check if this is a link click by matching data attributes
      const target = e.target as HTMLElement;
      
      // Try to find the closest link element starting from the click target
      const getLinkUrl = (element: HTMLElement | null): string | null => {
        if (!element) return null;
        
        // Check for various link indicators in priority order
        if (element.hasAttribute('data-url')) {
          return element.getAttribute('data-url');
        }
        
        if (element.hasAttribute('data-href')) {
          return element.getAttribute('data-href');
        }
        
        if (element.tagName === 'A' && element.hasAttribute('href')) {
          return element.getAttribute('href');
        }
        
        // Check data-link-overlay attribute
        if (element.hasAttribute('data-link-overlay')) {
          const url = element.getAttribute('data-url') || element.getAttribute('data-href');
          if (url) return url;
        }
        
        // Try parent element up to 3 levels
        let parent = element.parentElement;
        let level = 0;
        while (parent && level < 3) {
          if (parent.hasAttribute('data-url')) {
            return parent.getAttribute('data-url');
          }
          
          if (parent.hasAttribute('data-href')) {
            return parent.getAttribute('data-href');
          }
          
          if (parent.hasAttribute('data-link-overlay')) {
            const url = parent.getAttribute('data-url') || parent.getAttribute('data-href');
            if (url) return url;
          }
          
          parent = parent.parentElement;
          level++;
        }
        
        return null;
      };
      
      // Try to find a link URL from the clicked element or its parents
      const url = getLinkUrl(target);
      
      if (url) {
        // Found a link! Prevent default navigation and handle it
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        // Find the position of the click relative to textRef
        if (!document.body.contains(target)) {
          return; // Safety check in case the element is no longer in the DOM
        }
        
        // Get approximate normalized position from window coordinates
        const x = (e.clientX / window.innerWidth) * 2 - 1;
        const y = (e.clientY / window.innerHeight) * 2 - 1;
        
        console.log('Direct DOM click handler found link:', url);
        startWhiteout({ x, y }, url);
      }
    };
    
    // Function to handle touch events
    const handleDocumentTouch = (e: TouchEvent) => {
      if (e.touches.length !== 1) return; // Only handle single touches
      
      const touch = e.touches[0];

      const proximityMatch = resolveClosestLink(touch.clientX, touch.clientY);
      if (proximityMatch) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        console.log('Touch proximity match:', proximityMatch.link.url);
        startWhiteout(proximityMatch.normalized, proximityMatch.link.url);
        return;
      }

      const target = touch.target as HTMLElement;
      
      // Use the same URL detection logic as the click handler
      const getLinkUrl = (element: HTMLElement | null): string | null => {
        if (!element) return null;
        
        if (element.hasAttribute('data-url')) return element.getAttribute('data-url');
        if (element.hasAttribute('data-href')) return element.getAttribute('data-href');
        if (element.tagName === 'A' && element.hasAttribute('href')) return element.getAttribute('href');
        if (element.hasAttribute('data-link-overlay')) {
          return element.getAttribute('data-url') || element.getAttribute('data-href');
        }
        
        // Check parent elements up to 3 levels
        let parent = element.parentElement;
        let level = 0;
        while (parent && level < 3) {
          if (parent.hasAttribute('data-url')) return parent.getAttribute('data-url');
          if (parent.hasAttribute('data-href')) return parent.getAttribute('data-href');
          if (parent.hasAttribute('data-link-overlay')) {
            return parent.getAttribute('data-url') || parent.getAttribute('data-href');
          }
          parent = parent.parentElement;
          level++;
        }
        
        return null;
      };
      
      const url = getLinkUrl(target);
      
      if (url) {
        // Prevent default to avoid double tap delay
        e.preventDefault();
        
        // Get approximate normalized position
        const x = (touch.clientX / window.innerWidth) * 2 - 1;
        const y = (touch.clientY / window.innerHeight) * 2 - 1;
        
        console.log('Touch handler found link:', url);
        
        // Start whiteout immediately on touchstart
        startWhiteout({ x, y }, url);
      }
    };
    
    // Add click handler directly to document to catch all clicks
    document.addEventListener('click', handleDocumentClick, { capture: true });
    
    // Add touch handlers for mobile
    document.addEventListener('touchstart', handleDocumentTouch, { capture: true, passive: false });
    
    return () => {
      document.removeEventListener('click', handleDocumentClick, { capture: true });
      document.removeEventListener('touchstart', handleDocumentTouch, { capture: true });
    };
  }, [disabled, resolveClosestLink, startWhiteout]);

  // Improved link click handling with enhanced scroll awareness
  const handleClick = useCallback((e: MouseEvent) => {
    if (disabled) {
      return;
    }
    if (!textRef.current || !size.width || !size.height) return;
    
    // Don't process clicks during active scrolling
    if (isScrollingRef.current) {
      console.log('Ignoring click during scrolling');
      return;
    }
    
    // Get current scroll position at the moment of the click
    const currentScrollY = scrollOffsetRef.current;
    const scrolledY = Math.floor(currentScrollY / CHAR_HEIGHT);
    
    const proximityMatch = resolveClosestLink(e.clientX, e.clientY);
    if (proximityMatch) {
      console.log(`Proximity-selected link: ${proximityMatch.link.url}`);
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      startWhiteout(proximityMatch.normalized, proximityMatch.link.url);
      return;
    }
    
    // Helper function to trigger the whiteout effect
    const triggerWhiteout = (url: string) => {
      console.log('🔗 Link clicked, triggering whiteout to:', url);
      console.log('Current scroll position:', currentScrollY, 'chars:', scrolledY);
      
      // Completely stop event propagation and prevent default behavior
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      
      const rect = textRef.current!.getBoundingClientRect();
      const normalizedX = rect.width ? ((e.clientX - rect.left) / rect.width) * 2 - 1 : 0;
      const normalizedY = rect.height ? ((e.clientY - rect.top) / rect.height) * 2 - 1 : 0;
      
      startWhiteout({ x: normalizedX, y: normalizedY }, url);
      
      // Return false to prevent any other handlers
      return false;
    };
    
    // Check for data attributes first (most reliable)
    const target = e.target as HTMLElement;
    
    // Check for direct data-url attribute (added to link overlays)
    if (target.hasAttribute('data-url')) {
      const url = target.getAttribute('data-url');
      if (url) {
        console.log('Link clicked via data-url attribute:', url);
        return triggerWhiteout(url);
      }
    }
    
    // Check for data-href attribute
    if (target.hasAttribute('data-href')) {
      const url = target.getAttribute('data-href');
      if (url) {
        console.log('Link clicked via data-href attribute:', url);
        return triggerWhiteout(url);
      }
    }
    
    // Check link overlay attribute
    if (target.hasAttribute('data-link-overlay')) {
      const url = target.getAttribute('data-url') || target.getAttribute('data-href');
      if (url) {
        console.log('Link clicked via link overlay attribute:', url);
        return triggerWhiteout(url);
      }
    }
    
    // Check for standard anchor tag
    if (target.tagName === 'A' && target.getAttribute('href')) {
      const href = target.getAttribute('href');
      if (href) {
        console.log('Link clicked via anchor element:', href);
        e.preventDefault();
        return triggerWhiteout(href);
      }
    }
    
    // Check for closest link overlay
    const linkOverlay = target.closest('[data-link-overlay="true"]');
    if (linkOverlay) {
      const url = linkOverlay.getAttribute('data-url') || linkOverlay.getAttribute('data-href');
      if (url) {
        console.log('Link clicked via link overlay parent:', url);
        return triggerWhiteout(url);
      }
    }
    
    // Fallback to coordinate-based detection with current scroll position
    const rect = textRef.current.getBoundingClientRect();
    const relativeX = e.clientX - rect.left;
    const relativeY = e.clientY - rect.top;
    
    console.log("Click coordinates relative to text:", relativeX, relativeY);
    
    const gridX = Math.floor(relativeX / CHAR_WIDTH);
    // For Safari, compensate the click Y position with the same offset logic
    // This aligns the detection with the visual position of the links
    const gridY = Math.floor(relativeY / CHAR_HEIGHT);
    
    // Calculate the actual grid Y position with current scroll
    const adjustedGridY = gridY + scrolledY;
    
    console.log("Grid coordinates:", gridX, gridY, "Adjusted for scroll:", gridX, adjustedGridY);
    if (IS_SAFARI) {
      console.log("Safari detected - will apply proportional offset correction");
    }
    
    // Use an even more generous hit detection area for better reliability
    const hitSlop = 7;
    
    // Check each link position with greater tolerance
    for (const link of linkPositionsRef.current) {
      const isFixed = textPositionCache.bounds[link.textKey]?.fixed || false;
      const linkY = isFixed ? link.y : link.y - scrolledY;
      
      // Calculate Safari offset for this link position
      const safariOffset = calculateSafariOffset(scrolledY, isFixed);
      
      // Calculate effective Y position with Safari correction
      // For Safari, we need to adjust the link's Y position to match the click position
      const effectiveLinkY = IS_SAFARI ? (linkY + (safariOffset / CHAR_HEIGHT)) : linkY;
      
      console.log(`Testing link ${link.url} at pos:`, link.startX, effectiveLinkY, "to", link.endX, effectiveLinkY);
      if (IS_SAFARI) {
        console.log(`Safari offset applied: ${safariOffset}px (${safariOffset / CHAR_HEIGHT} chars)`);
      }
      
      // Improved hit detection with greater tolerance and Safari adjustment
      if (gridX >= link.startX - hitSlop && 
          gridX <= link.endX + hitSlop && 
          Math.abs(gridY - effectiveLinkY) <= hitSlop) {
        console.log('Link detected via coordinate check:', link.url);
        return triggerWhiteout(link.url);
      }
    }
    
    console.log("No link found at click position with current scroll:", scrolledY);
  }, [calculateSafariOffset, disabled, resolveClosestLink, size.height, size.width, textPositionCache.bounds, scrollOffsetRef, startWhiteout, textRef]);

  // Force update link overlays when scroll position changes
  useEffect(() => {
    updateLinkOverlays();
  }, [size.width, size.height, textPositionCache.links, updateLinkOverlays]);

  return {
    updateLinkOverlays,
    handleClick
  };
};
