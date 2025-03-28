import { CHAR_WIDTH, CHAR_HEIGHT } from './constants';
import { GridDimensions } from './types';

/**
 * Calculate grid dimensions based on pixel size
 * @param width - Width in pixels
 * @param height - Height in pixels
 * @returns Grid dimensions object with columns and rows
 */
export const getGridDimensions = (width: number, height: number): GridDimensions => {
  const cols = Math.floor(width / CHAR_WIDTH);
  const rows = Math.ceil(height / CHAR_HEIGHT);
  return { cols, rows };
};

/**
 * Create a lookup table for sine values from 0-359 degrees
 * @returns Array of sine values
 */
export const createSinTable = (): number[] => {
  const table = new Array(360);
  for (let i = 0; i < 360; i++) {
    table[i] = Math.sin((i * Math.PI) / 180);
  }
  return table;
};

/**
 * Create a lookup table for cosine values from 0-359 degrees
 * @returns Array of cosine values
 */
export const createCosTable = (): number[] => {
  const table = new Array(360);
  for (let i = 0; i < 360; i++) {
    table[i] = Math.cos((i * Math.PI) / 180);
  }
  return table;
};

/**
 * Create a fast sine function using a lookup table
 * @param sinTable - Precomputed sine table
 * @returns Fast sine function
 */
export const createFastSin = (sinTable: number[]) => {
  return (angle: number): number => {
    const index = Math.floor(((angle % (2 * Math.PI)) / (2 * Math.PI)) * 360) % 360;
    return sinTable[index >= 0 ? index : index + 360];
  };
};

/**
 * Create a fast cosine function using a lookup table
 * @param cosTable - Precomputed cosine table
 * @returns Fast cosine function
 */
export const createFastCos = (cosTable: number[]) => {
  return (angle: number): number => {
    const index = Math.floor(((angle % (2 * Math.PI)) / (2 * Math.PI)) * 360) % 360;
    return cosTable[index >= 0 ? index : index + 360];
  };
}; 