import { CHAR_WIDTH, CHAR_HEIGHT, IS_SAFARI, SAFARI_LINK_OFFSET_BASE, SAFARI_LINK_OFFSET_FACTOR } from '../../constants';
import { Size, LinkPosition, LinkOverlay, TextPositionCacheResult } from '../../types';

// Calculate Safari-specific offset based on scroll position
export const calculateSafariOffset = (
  scrollY: number, 
  isFixed: boolean
): number => {
  if (!IS_SAFARI) return 0;
  
  // For fixed content, use a constant offset
  if (isFixed) return SAFARI_LINK_OFFSET_BASE;
  
  // For scrollable content, apply additional offset based on scroll position
  return SAFARI_LINK_OFFSET_BASE + (scrollY * SAFARI_LINK_OFFSET_FACTOR);
};

// Create link overlay elements
export const createLinkOverlays = (
  size: Size,
  linkPositions: LinkPosition[],
  scrollOffsetY: number,
  textPositionCache: TextPositionCacheResult
): LinkOverlay[] => {
  if (!size.width || !size.height) return [];
  
  const scrolledY = Math.floor(scrollOffsetY / CHAR_HEIGHT);
  const newOverlays: LinkOverlay[] = [];
  
  for (const link of linkPositions) {
    const isFixed = textPositionCache.bounds[link.textKey]?.fixed || false;
    const linkY = isFixed ? link.y : link.y - scrolledY;
    
    // Use a wider range to ensure we catch all links that might be partially visible
    if (linkY >= -15 && linkY < (size.height / CHAR_HEIGHT) + 15) {
      // Apply Safari offset if needed
      const safariOffset = calculateSafariOffset(scrollOffsetY, isFixed);
      
      // Calculate exact position with pixel precision
      const left = Math.max(0, link.startX * CHAR_WIDTH);
      const top = (linkY * CHAR_HEIGHT) + safariOffset;
      
      const width = (link.endX - link.startX + 1) * CHAR_WIDTH;
      // Create a taller clickable area for better hit detection
      const height = CHAR_HEIGHT * 3;
      
      newOverlays.push({
        url: link.url,
        style: {
          position: 'absolute',
          left: `${left}px`,
          top: `${top}px`,
          width: `${width}px`,
          height: `${height}px`,
          backgroundColor: 'transparent',
          cursor: 'pointer',
          zIndex: 9999,
          pointerEvents: 'auto',
          transform: 'translateZ(0)',
          outline: 'none',
          display: 'block',
          padding: 0,
          margin: 0,
          boxSizing: 'border-box',
          userSelect: 'none'
        }
      });
    }
  }
  
  return newOverlays;
}; 