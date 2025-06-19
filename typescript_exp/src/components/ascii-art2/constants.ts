// Character sets and rendering constants
export const selectedCharacterSet = "$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/|()1{}[]?-_+~i!lI;:,^`'. ";
export const characterSetLength = selectedCharacterSet.length;
export const SCALE_FACTOR = 10;
export const CHAR_WIDTH = SCALE_FACTOR * 0.6;  // Adjusted to match actual character width
export const CHAR_HEIGHT = SCALE_FACTOR;

// Animation constants
export const FRAME_DURATION = 1000 / 60; // Target 60 FPS
export const BORDER_FREQUENCY = 0.05;  // Controls wave speed on borders
export const HORIZONTAL_PADDING = 0;  // No whitespace borders

// Blob rendering
export const BLOB_RADIUS = 10;  // Size of blob effect
export const BLOB_PADDING = 15; // Padding around blobs
export const GRID_CELL_SIZE = 4; // Cell size for spatial partitioning
export const BLOB_CACHE_GRID_SIZE = 4; // Size of cells in the blob cache grid

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