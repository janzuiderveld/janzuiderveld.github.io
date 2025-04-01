import { useCallback, useRef } from 'react';
import { 
  BLOB_CACHE_GRID_SIZE, 
  BLOB_RADIUS, 
  CHAR_HEIGHT, 
  GRID_CELL_SIZE 
} from '../constants';
import { 
  BlobGridCache, 
  SpatialGrid, 
  TextPositionCacheResult, 
  Size 
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
    
    const padding = BLOB_RADIUS * 3;
    const cacheStartX = -padding;
    const cacheStartY = -padding;
    const cacheWidth = cols + padding * 2;
    const cacheHeight = rows * 4 + padding * 2;
    
    const gridWidth = Math.ceil(cacheWidth / BLOB_CACHE_GRID_SIZE);
    const gridHeight = Math.ceil(cacheHeight / BLOB_CACHE_GRID_SIZE);
    
    const newGrid: (Uint8Array | null)[] = new Array(gridWidth * gridHeight).fill(null);
     
    const spatialGrid: SpatialGrid = {};
    const cellSize = GRID_CELL_SIZE * BLOB_RADIUS;
    
    for (const textKey in textPositionCache.cache) {
      const positions = textPositionCache.cache[textKey];
      const bounds = textPositionCache.bounds[textKey];
      const isFixed = bounds.fixed;
      
      for (const pos of positions) {
        const effectiveY = isFixed ? pos.y : pos.y - scrolledY;
        
        if (effectiveY < cacheStartY - BLOB_RADIUS || 
            effectiveY > cacheStartY + cacheHeight + BLOB_RADIUS) {
          continue;
        }
        if (pos.startX < cacheStartX - BLOB_RADIUS || 
            pos.startX > cacheStartX + cacheWidth + BLOB_RADIUS) {
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
      }
    }
    
    for (let gy = 0; gy < gridHeight; gy++) {
      for (let gx = 0; gx < gridWidth; gx++) {
        const cellArray = new Uint8Array(BLOB_CACHE_GRID_SIZE * BLOB_CACHE_GRID_SIZE);
        const cellIndex = gy * gridWidth + gx;
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
        if (spatialCellsToCheck.length === 0) continue;
        
        for (let localY = 0; localY < BLOB_CACHE_GRID_SIZE; localY++) {
          for (let localX = 0; localX < BLOB_CACHE_GRID_SIZE; localX++) {
            const worldX = cellWorldX + localX;
            const worldY = cellWorldY + localY;
            const index = localY * BLOB_CACHE_GRID_SIZE + localX;
            
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