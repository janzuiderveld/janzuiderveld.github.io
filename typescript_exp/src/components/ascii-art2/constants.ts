// Character sets and rendering constants
export const selectedCharacterSet = "$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/|()1{}[]?-_+~i!lI;:,^`'. ";
export const characterSetLength = selectedCharacterSet.length;

const BASE_SCALE_FACTOR = 13;
const MOBILE_SCALE_FACTOR = 9;
const MOBILE_BREAKPOINT_PX = 760;
const WIDTH_TO_HEIGHT_RATIO = 0.6; // Estimated monospace width/height ratio

const deriveScaleFactor = (viewportWidth?: number) => {
  const width = viewportWidth ?? (typeof window !== 'undefined'
    ? (window.visualViewport?.width ?? window.innerWidth)
    : undefined);

  if (width && width < MOBILE_BREAKPOINT_PX) {
    return MOBILE_SCALE_FACTOR;
  }

  return BASE_SCALE_FACTOR;
};

export let SCALE_FACTOR = deriveScaleFactor();
export let CHAR_WIDTH = SCALE_FACTOR * WIDTH_TO_HEIGHT_RATIO;  // Adjusted to match actual character width
export let CHAR_HEIGHT = SCALE_FACTOR;

const updateDimensions = (scale: number) => {
  SCALE_FACTOR = scale;
  CHAR_WIDTH = SCALE_FACTOR * WIDTH_TO_HEIGHT_RATIO;
  CHAR_HEIGHT = SCALE_FACTOR;
};

export const updateCharMetricsForViewport = (viewportWidth?: number) => {
  const nextScale = deriveScaleFactor(viewportWidth);

  if (nextScale !== SCALE_FACTOR) {
    updateDimensions(nextScale);
  }

  return {
    scaleFactor: SCALE_FACTOR,
    charWidth: CHAR_WIDTH,
    charHeight: CHAR_HEIGHT
  };
};

export const getCurrentCharMetrics = () => ({
  scaleFactor: SCALE_FACTOR,
  charWidth: CHAR_WIDTH,
  charHeight: CHAR_HEIGHT
});

// Animation constants
export const FRAME_DURATION = 1000 / 60; // Target 60 FPS
export const BORDER_FREQUENCY = 0.05;  // Controls wave speed on borders
export const HORIZONTAL_PADDING = 0;  // No whitespace borders

// Blob rendering
export const BLOB_RADIUS = 10;  // Size of blob effect
export const BLOB_PADDING = 15; // Padding around blobs
export const GRID_CELL_SIZE = 4; // Cell size for spatial partitioning
export const BLOB_CACHE_GRID_SIZE = 4; // Size of cells in the blob cache grid
export const BLOB_CACHE_HEIGHT_MULTIPLIER = 2.8; // Number of viewport heights cached vertically
export const SAFARI_BLOB_CACHE_HEIGHT_MULTIPLIER = 1.8; // Slightly shallower cache for Safari performance
export const BLOB_PADDING_MULTIPLIER = 2.6; // Radius-based padding multiplier
export const SAFARI_BLOB_PADDING_MULTIPLIER = 1.9; // Reduced padding for Safari performance

// Browser-specific adjustments 
export const IS_SAFARI = typeof navigator !== 'undefined' && 
                 /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
export const SAFARI_LINK_Y_OFFSET = IS_SAFARI ? 5 : 0; // Pixels
export const SAFARI_CURSOR_Y_OFFSET = IS_SAFARI ? -3 : 0; // Pixels

// Safari-specific constants
export const SAFARI_LINK_OFFSET_BASE = 30; // Base offset in pixels (increased for visibility)
export const SAFARI_LINK_OFFSET_FACTOR = 0.05; // Proportional factor for scroll-based adjustment (increased)

// Debug constants
export const DEBUG_LINK_OVERLAYS = false; // Set to true to visualize link overlay areas

// Performance constants
export const MOUSE_MOVE_THROTTLE = 16; // ~60fps
export const BASE_CHUNK_SIZE = 15; 
