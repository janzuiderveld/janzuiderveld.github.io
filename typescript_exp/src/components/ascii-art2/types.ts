import { FontName } from '../ASCII_text_renderer';
import React from 'react';

/**
 * Component Props
 */
export interface AsciiArtGeneratorProps {
  textContent: Array<{
    text: string, 
    x: number, // Percentage of page width (0-100)
    y: number, // Percentage of page height (0-100)
    fontName?: FontName, // 'regular', 'ascii', or 'smallAscii'
    preRenderedAscii?: string,
    fixed?: boolean,
    maxWidthPercent?: number,
    alignment?: 'left' | 'center' | 'right',
    usePercentPosition?: boolean,
    centered?: boolean,
    name?: string, // Unique identifier for the textbox
    anchorTo?: string, // Name of the textbox to anchor to
    anchorOffsetX?: number, // Horizontal offset from the anchor (can be negative)
    anchorOffsetY?: number, // Vertical offset from the anchor (can be negative)
    anchorPoint?: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight' | 'center' // Which point of the anchor textbox to use
  }>;
  maxScrollHeight?: number;
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

export interface TextPositionCacheResult {
  cache: TextPositionCache; 
  grid: { [key: string]: { char: string; fixed: boolean; isBold?: boolean; isItalic?: boolean } };
  bounds: {[key: string]: TextBounds};
  links: LinkPosition[];
}

export interface SpatialGrid {
  [key: string]: Array<{textKey: string, x: number, y: number}>;
}

/**
 * Blob Cache
 */
export interface BlobGridCache {
  grid: {[key: string]: Uint8Array};
  startX: number;
  startY: number;
  width: number;
  height: number;
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
} 