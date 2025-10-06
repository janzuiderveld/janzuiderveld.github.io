import { useCallback, useRef } from 'react';
import { 
  BLOB_CACHE_GRID_SIZE, 
  BLOB_RADIUS, 
  BLOB_CACHE_HEIGHT_MULTIPLIER,
  SAFARI_BLOB_CACHE_HEIGHT_MULTIPLIER,
  BLOB_PADDING_MULTIPLIER,
  SAFARI_BLOB_PADDING_MULTIPLIER,
  CHAR_HEIGHT, 
  GRID_CELL_SIZE,
  IS_SAFARI
} from '../constants';
import { 
  BlobGridCache, 
  SpatialGrid, 
  TextPositionCacheResult, 
  Size,
  TextPositionCache
} from '../types';
import { getGridDimensions } from '../utils';

export const useBlobCache = (
  textPositionCache: TextPositionCacheResult,
  size: Size
) => {
  const blobGridCache = useRef<BlobGridCache>({
    grid: [],
    startX: 0,
    startY: 0,
    width: 0,
    height: 0,
    cacheGridWidth: 0
  });
  
  const spatialGridRef = useRef<SpatialGrid>({});
  const needsRebuildRef = useRef(true);
  const rebuildCacheTimeoutRef = useRef<number | null>(null);

  const buildBlobCache = useCallback((scrollY: number = 0) => {
    if (!size.width || !size.height) return;
    
    const scrolledY = Math.floor(scrollY / CHAR_HEIGHT);
    const { cols, rows } = getGridDimensions(size.width, size.height);
    
    const paddingMultiplier = IS_SAFARI ? SAFARI_BLOB_PADDING_MULTIPLIER : BLOB_PADDING_MULTIPLIER;
    const padding = Math.max(1, Math.round(BLOB_RADIUS * paddingMultiplier));
    const cacheStartX = -padding;
    const cacheStartY = -padding;
    const cacheWidth = cols + padding * 2;
    const cacheHeightMultiplier = IS_SAFARI ? SAFARI_BLOB_CACHE_HEIGHT_MULTIPLIER : BLOB_CACHE_HEIGHT_MULTIPLIER;
    const cacheHeight = Math.ceil(rows * cacheHeightMultiplier) + padding * 2;

    const gridWidth = Math.ceil(cacheWidth / BLOB_CACHE_GRID_SIZE);
    const gridHeight = Math.ceil((cacheHeight + BLOB_CACHE_GRID_SIZE - 1) / BLOB_CACHE_GRID_SIZE);

    const totalCells = gridWidth * gridHeight;
    const newGrid: (Uint8Array | null)[] = new Array(totalCells).fill(null);
    const previousGrid = blobGridCache.current.grid;
     
    const spatialGrid: SpatialGrid = {};
    const cellSize = GRID_CELL_SIZE * BLOB_RADIUS;
    const activeCellIndices = new Set<number>();
    
    const minEffectiveY = cacheStartY - BLOB_RADIUS;
    const maxEffectiveY = cacheStartY + cacheHeight + BLOB_RADIUS;
    const minEffectiveX = cacheStartX - BLOB_RADIUS;
    const maxEffectiveX = cacheStartX + cacheWidth + BLOB_RADIUS;

    type CacheEntry = TextPositionCache[string][number];

    const findVerticalSlice = (positions: CacheEntry[], startY: number, endY: number) => {
      let startIndex = 0;
      let endIndex = positions.length;

      let low = 0;
      let high = positions.length;
      while (low < high) {
        const mid = (low + high) >> 1;
        if (positions[mid].y < startY) {
          low = mid + 1;
        } else {
          high = mid;
        }
      }
      startIndex = low;

      low = startIndex;
      high = positions.length;
      while (low < high) {
        const mid = (low + high) >> 1;
        if (positions[mid].y <= endY) {
          low = mid + 1;
        } else {
          high = mid;
        }
      }
      endIndex = low;

      return { startIndex, endIndex };
    };

    for (const textKey in textPositionCache.cache) {
      const positions = textPositionCache.cache[textKey];
      if (!positions.length) continue;

      const bounds = textPositionCache.bounds[textKey];
      if (!bounds) continue;

      const isFixed = bounds.fixed;

      if (bounds.maxX < minEffectiveX || bounds.minX > maxEffectiveX) {
        continue;
      }

      const absoluteMinY = isFixed ? minEffectiveY : minEffectiveY + scrolledY;
      const absoluteMaxY = isFixed ? maxEffectiveY : maxEffectiveY + scrolledY;

      if (bounds.maxY < absoluteMinY || bounds.minY > absoluteMaxY) {
        continue;
      }

      let startIndex = 0;
      let endIndex = positions.length;

      if (!isFixed) {
        const slice = findVerticalSlice(positions, absoluteMinY, absoluteMaxY);
        startIndex = slice.startIndex;
        endIndex = slice.endIndex;
      }

      for (let i = startIndex; i < endIndex; i++) {
        const pos = positions[i];
        const effectiveY = isFixed ? pos.y : pos.y - scrolledY;

        if (effectiveY < minEffectiveY || effectiveY > maxEffectiveY) {
          continue;
        }
        if (pos.startX < minEffectiveX || pos.startX > maxEffectiveX) {
          continue;
        }

        const gridX = Math.floor(pos.startX / cellSize);
        const gridY = Math.floor(effectiveY / cellSize);
        const cellKey = `${gridX},${gridY}`;

        if (!spatialGrid[cellKey]) spatialGrid[cellKey] = [];
        spatialGrid[cellKey].push({
          textKey,
          x: pos.startX,
          y: effectiveY,
          fixed: isFixed
        });

        const minGX = Math.max(0, Math.floor((pos.startX - BLOB_RADIUS - cacheStartX) / BLOB_CACHE_GRID_SIZE));
        const maxGX = Math.min(gridWidth - 1, Math.floor((pos.startX + BLOB_RADIUS - cacheStartX) / BLOB_CACHE_GRID_SIZE));
        const minGY = Math.max(0, Math.floor((effectiveY - BLOB_RADIUS - cacheStartY) / BLOB_CACHE_GRID_SIZE));
        const maxGY = Math.min(gridHeight - 1, Math.floor((effectiveY + BLOB_RADIUS - cacheStartY) / BLOB_CACHE_GRID_SIZE));

        for (let gy = minGY; gy <= maxGY; gy++) {
          const baseIndex = gy * gridWidth;
          for (let gx = minGX; gx <= maxGX; gx++) {
            activeCellIndices.add(baseIndex + gx);
          }
        }
      }
    }
    
    if (!activeCellIndices.size) {
      blobGridCache.current = {
        grid: newGrid,
        startX: cacheStartX,
        startY: cacheStartY,
        width: cacheWidth,
        height: cacheHeight,
        cacheGridWidth: gridWidth
      };
      spatialGridRef.current = spatialGrid;
      needsRebuildRef.current = false;
      return;
    }

    for (const cellIndex of activeCellIndices) {
      if (cellIndex < 0 || cellIndex >= totalCells) continue;

      const gy = Math.floor(cellIndex / gridWidth);
      const gx = cellIndex - gy * gridWidth;

      let cellArray = previousGrid[cellIndex];
      if (!cellArray || cellArray.length !== BLOB_CACHE_GRID_SIZE * BLOB_CACHE_GRID_SIZE) {
        cellArray = new Uint8Array(BLOB_CACHE_GRID_SIZE * BLOB_CACHE_GRID_SIZE);
      } else {
        cellArray.fill(0);
      }
      newGrid[cellIndex] = cellArray;

      const cellWorldX = cacheStartX + gx * BLOB_CACHE_GRID_SIZE;
      const cellWorldY = cacheStartY + gy * BLOB_CACHE_GRID_SIZE;

      const spatialCellsToCheck: string[] = [];
      const minSpatialX = Math.floor((cellWorldX - BLOB_RADIUS) / cellSize);
      const maxSpatialX = Math.floor((cellWorldX + BLOB_CACHE_GRID_SIZE + BLOB_RADIUS) / cellSize);
      const minSpatialY = Math.floor((cellWorldY - BLOB_RADIUS) / cellSize);
      const maxSpatialY = Math.floor((cellWorldY + BLOB_CACHE_GRID_SIZE + BLOB_RADIUS) / cellSize);

      for (let sy = minSpatialY; sy <= maxSpatialY; sy++) {
        for (let sx = minSpatialX; sx <= maxSpatialX; sx++) {
          const spatialKey = `${sx},${sy}`;
          if (spatialGrid[spatialKey]) {
            spatialCellsToCheck.push(spatialKey);
          }
        }
      }
      if (spatialCellsToCheck.length === 0) {
        continue;
      }

      for (let localY = 0; localY < BLOB_CACHE_GRID_SIZE; localY++) {
        const rowOffset = localY * BLOB_CACHE_GRID_SIZE;
        const worldY = cellWorldY + localY;

        for (let localX = 0; localX < BLOB_CACHE_GRID_SIZE; localX++) {
          const worldX = cellWorldX + localX;
          const index = rowOffset + localX;

          let isInterior = false;
          let isBorder = false;

          for (const spatialKey of spatialCellsToCheck) {
            const positions = spatialGrid[spatialKey];

            for (const pos of positions) {
              const dx = worldX - pos.x;
              const dy = worldY - pos.y;
              const distanceSquared = dx * dx + dy * dy * 1.5;

              if (distanceSquared < (BLOB_RADIUS - 1.5) * (BLOB_RADIUS - 1.5)) {
                isInterior = true;
                break;
              }
              if (distanceSquared < BLOB_RADIUS * BLOB_RADIUS) {
                isBorder = true;
              }
            }
            if (isInterior) break;
          }

          cellArray[index] = isInterior ? 1 : (isBorder ? 2 : 0);
        }
      }
    }
    
    blobGridCache.current = {
      grid: newGrid,
      startX: cacheStartX,
      startY: cacheStartY,
      width: cacheWidth,
      height: cacheHeight,
      cacheGridWidth: gridWidth
    };
    
    spatialGridRef.current = spatialGrid;
    needsRebuildRef.current = false;
  }, [size, textPositionCache]);

  return {
    blobGridCache,
    spatialGridRef,
    needsRebuildRef,
    rebuildCacheTimeoutRef,
    buildBlobCache
  };
}; 
