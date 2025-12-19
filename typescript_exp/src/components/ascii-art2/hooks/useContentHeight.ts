import { useMemo } from 'react';
import { CHAR_HEIGHT } from '../constants';
import { Size, TextBounds } from '../types';

export const useContentHeight = (
  textBounds: { [key: string]: TextBounds },
  size: Size,
  maxScrollHeight?: number
) => {
  // Calculate content height based on bounds
  const contentHeight = useMemo(() => {
    // Check if textBounds is populated
    if (Object.keys(textBounds).length === 0) return 0; 
    
    let maxY = 0;
    // Iterate through the values (bounds) of the textBounds map
    Object.values(textBounds).forEach((bounds: TextBounds) => {
      // Skip items marked as fixed
      if (bounds.fixed) return; 
      // Use the calculated maxY from the bounds
      maxY = Math.max(maxY, bounds.maxY); 
    });
    
    // Add 1 because maxY is 0-indexed, then multiply by char height.
    return (maxY + 1) * CHAR_HEIGHT; 
  // Update dependency array to use textBounds
  }, [textBounds]); 

  // Calculate max scroll (logic remains the same)
  const maxScroll = useMemo(() => {
    if (!size.height) return 0;
    const midViewportPaddingPx = Math.ceil((size.height / 2) / CHAR_HEIGHT) * CHAR_HEIGHT;
    const effectiveMaxHeight = (maxScrollHeight || contentHeight) + midViewportPaddingPx;
    // Ensure maxScroll is never negative
    return Math.max(0, effectiveMaxHeight - size.height); 
  }, [size.height, contentHeight, maxScrollHeight]);

  return {
    contentHeight,
    maxScroll
  };
}; 
