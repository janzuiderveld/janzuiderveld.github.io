import { FontName } from './ASCII_text_renderer';
import React from 'react';

/**
 * Component Props
 */
export interface AsciiArtGeneratorProps {
  textContent: TextContentItem[];
  maxScrollHeight?: number;
  onScrollOffsetChange?: (offset: number) => void;
}

/**
 * Text Content Types
 */
export interface TextContentItem {
  text: string;
  x: number;
  y: number;
  fontName?: FontName;
  preRenderedAscii?: string;
  fixed?: boolean;
  maxWidthPercent?: number;
  alignment?: 'left' | 'center' | 'right';
  usePercentPosition?: boolean;
  centered?: boolean;
  name?: string;
  anchorTo?: string;
  anchorOffsetX?: number;
  anchorOffsetY?: number;
  anchorPoint?: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight' | 'center' | 'bottomCenter';
}

export interface TextBox extends TextContentItem {
  maxWidth?: number;
}

/**
 * Text Positioning and Layout
 */
export interface Size {
  height: number | null;
  width: number | null;
}

export interface GridDimensions {
  cols: number;
  rows: number;
}

export interface TextBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  fixed: boolean;
}

export interface TextPositionCache {
  [key: string]: {
    startX: number;
    endX: number;
    y: number;
    char: string;
    fixed: boolean;
    isBold?: boolean;
    isItalic?: boolean;
  }[];
}

// Represents a single character cell in the main grid
export type TextGridCell = { 
  char: string; 
  fixed: boolean; 
  isBold?: boolean; 
  isItalic?: boolean 
} | null; // Use null for empty cells

export interface TextPositionCacheResult {
  cache: TextPositionCache; 
  grid: TextGridCell[]; // Flat array: index = y * cols + x
  bounds: {[key: string]: TextBounds};
  links: LinkPosition[];
  gridCols: number; // Store grid width (columns)
  offsetY: number;  // Store vertical offset for grid indexing
}

export interface SpatialGrid {
  [key: string]: Array<{textKey: string, x: number, y: number, fixed?: boolean}>;
}

/**
 * Blob Cache
 */
export interface BlobGridCache {
  grid: (Uint8Array | null)[]; // Flat array of Uint8Array cells: index = gridY * cacheGridWidth + gridX
  startX: number;
  startY: number;
  width: number; // Width in characters
  height: number; // Height in characters
  cacheGridWidth: number; // Width of the grid of Uint8Array cells
}

/**
 * Links
 */
export interface LinkPosition {
  textKey: string;
  url: string;
  startX: number;
  endX: number;
  y: number;
}

export interface LinkOverlay {
  url: string;
  style: React.CSSProperties;
}

/**
 * Cursor Effects
 */
export interface ClickRipple {
  position: { x: number; y: number };
  timestamp: number;
  lifespan: number;
  intensity: number;
  speedFactor: number;
}

export interface WhiteoutState {
  active: boolean;
  position: { x: number; y: number };
  timestamp: number;
  targetUrl: string;
  progress: number; // 0 to 1, representing the progress of the whiteout effect
  duration: number; // Duration in ms for the complete whiteout
  justStarted?: boolean; // Flag to indicate the whiteout has just started
}

export interface WhiteInState {
  active: boolean;
  position: { x: number; y: number };
  timestamp: number;
  progress: number; // 1 to 0, representing the progress of the white-in effect (1 = all white, 0 = fully visible)
  duration: number; // Duration in ms for the complete white-in
}

export interface WhiteOverlayState {
  active: boolean;
  timestamp: number;
  fadeInComplete: boolean; // Flag to indicate if fade-in is complete
}

export interface CursorState {
  grid: { x: number; y: number };
  normalized: { x: number; y: number };
  isInWindow: boolean;
  isActive: boolean;
  clickRipples: ClickRipple[];
  whiteout: WhiteoutState | null;
  whiteIn: WhiteInState | null;
  whiteOverlay: WhiteOverlayState | null;
  isScrolling?: boolean; // Added to track scrolling state for performance optimizations
} 
