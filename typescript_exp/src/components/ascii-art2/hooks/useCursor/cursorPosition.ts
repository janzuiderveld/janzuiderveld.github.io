import { CHAR_WIDTH, CHAR_HEIGHT, SAFARI_CURSOR_Y_OFFSET } from '../../constants';
import { Size } from '../../types';
import { CursorState } from './types';

export const updateCursorPosition = (
  cursorRef: React.MutableRefObject<CursorState>,
  size: Size,
  relativeX: number, 
  relativeY: number, 
  isTouchStart: boolean = false
) => {
  // Calculate grid position (character-based)
  const gridX = Math.floor(relativeX / CHAR_WIDTH);
  const gridY = Math.floor(relativeY / CHAR_HEIGHT);
  
  // Normalize coordinates for effects to -1...1 range
  const normalizedX = (relativeX / (size.width || 1)) * 2 - 1;
  const normalizedY = (relativeY / (size.height || 1)) * 2 - 1;
  
  // Update cursor state
  cursorRef.current = {
    ...cursorRef.current,
    grid: { x: gridX, y: gridY },
    normalized: { x: normalizedX, y: normalizedY },
    isInWindow: true,
    isActive: isTouchStart || cursorRef.current.isActive
  };
  
  return { 
    gridX, 
    gridY, 
    normalizedX, 
    normalizedY 
  };
};

export const handleTouchPosition = (
  e: TouchEvent,
  textRef: React.RefObject<HTMLPreElement>, 
  callback: (relativeX: number, relativeY: number, isTouchStart: boolean) => void
) => {
  if (!textRef.current) return;
  
  const touch = e.touches[0];
  const rect = textRef.current.getBoundingClientRect();
  const relativeX = touch.clientX - rect.left;
  const relativeY = touch.clientY - rect.top + SAFARI_CURSOR_Y_OFFSET;
  
  callback(relativeX, relativeY, e.type === 'touchstart');
  
  // Only prevent default for touchmove to allow scrolling
  if (e.type === 'touchmove') {
    e.preventDefault();
  }
}; 