import { useCallback, useRef } from 'react';
import {
  BLOB_CACHE_GRID_SIZE,
  BLOB_PADDING_MULTIPLIER,
  BLOB_RADIUS,
  GRID_CELL_SIZE,
  IS_SAFARI,
  SAFARI_BLOB_PADDING_MULTIPLIER
} from '../constants';
import {
  BlobCachePlane,
  BlobGridCache,
  SpatialGrid,
  Size,
  TextPositionCacheResult
} from '../types';
import { getGridDimensions } from '../utils';

const createEmptyPlane = (): BlobCachePlane => ({
  grid: [],
  startX: 0,
  startY: 0,
  width: 0,
  height: 0,
  cacheGridWidth: 0
});

const createEmptyBlobCache = (): BlobGridCache => ({
  fixed: createEmptyPlane(),
  scroll: createEmptyPlane()
});

type PlaneBuildConfig = {
  bounds: TextPositionCacheResult['bounds'];
  cache: TextPositionCacheResult['cache'];
  cols: number;
  includeFixed: boolean;
  startY: number;
  height: number;
  previousPlane: BlobCachePlane;
};

const buildPlane = ({
  bounds,
  cache,
  cols,
  includeFixed,
  startY,
  height,
  previousPlane
}: PlaneBuildConfig): BlobCachePlane => {
  if (height <= 0) {
    return createEmptyPlane();
  }

  const paddingMultiplier = IS_SAFARI ? SAFARI_BLOB_PADDING_MULTIPLIER : BLOB_PADDING_MULTIPLIER;
  const padding = Math.max(1, Math.round(BLOB_RADIUS * paddingMultiplier));
  const cacheStartX = -padding;
  const cacheWidth = cols + padding * 2;
  const gridWidth = Math.ceil(cacheWidth / BLOB_CACHE_GRID_SIZE);
  const gridHeight = Math.ceil(height / BLOB_CACHE_GRID_SIZE);
  const totalCells = gridWidth * gridHeight;
  const nextGrid: (Uint8Array | null)[] = new Array(totalCells).fill(null);
  const spatialGrid: SpatialGrid = {};
  const activeCellIndices = new Set<number>();
  const cellSize = GRID_CELL_SIZE * BLOB_RADIUS;
  const minEffectiveX = cacheStartX - BLOB_RADIUS;
  const maxEffectiveX = cacheStartX + cacheWidth + BLOB_RADIUS;
  const minEffectiveY = startY - BLOB_RADIUS;
  const maxEffectiveY = startY + height + BLOB_RADIUS;

  const previousGrid = previousPlane.grid;

  for (const textKey in cache) {
    const textBounds = bounds[textKey];
    if (!textBounds || textBounds.fixed !== includeFixed) {
      continue;
    }

    if (textBounds.maxX < minEffectiveX || textBounds.minX > maxEffectiveX) {
      continue;
    }

    if (textBounds.maxY < minEffectiveY || textBounds.minY > maxEffectiveY) {
      continue;
    }

    const positions = cache[textKey];
    for (let index = 0; index < positions.length; index += 1) {
      const position = positions[index];
      const effectiveY = position.y;

      if (position.startX < minEffectiveX || position.startX > maxEffectiveX) {
        continue;
      }

      if (effectiveY < minEffectiveY || effectiveY > maxEffectiveY) {
        continue;
      }

      const spatialX = Math.floor(position.startX / cellSize);
      const spatialY = Math.floor(effectiveY / cellSize);
      const spatialKey = `${spatialX},${spatialY}`;
      if (!spatialGrid[spatialKey]) {
        spatialGrid[spatialKey] = [];
      }
      spatialGrid[spatialKey].push({
        textKey,
        x: position.startX,
        y: effectiveY,
        fixed: includeFixed
      });

      const minGX = Math.max(0, Math.floor((position.startX - BLOB_RADIUS - cacheStartX) / BLOB_CACHE_GRID_SIZE));
      const maxGX = Math.min(gridWidth - 1, Math.floor((position.startX + BLOB_RADIUS - cacheStartX) / BLOB_CACHE_GRID_SIZE));
      const minGY = Math.max(0, Math.floor((effectiveY - BLOB_RADIUS - startY) / BLOB_CACHE_GRID_SIZE));
      const maxGY = Math.min(gridHeight - 1, Math.floor((effectiveY + BLOB_RADIUS - startY) / BLOB_CACHE_GRID_SIZE));

      for (let gridY = minGY; gridY <= maxGY; gridY += 1) {
        const rowOffset = gridY * gridWidth;
        for (let gridX = minGX; gridX <= maxGX; gridX += 1) {
          activeCellIndices.add(rowOffset + gridX);
        }
      }
    }
  }

  if (!activeCellIndices.size) {
    return {
      grid: nextGrid,
      startX: cacheStartX,
      startY,
      width: cacheWidth,
      height,
      cacheGridWidth: gridWidth
    };
  }

  for (const cellIndex of activeCellIndices) {
    const cellY = Math.floor(cellIndex / gridWidth);
    const cellX = cellIndex - cellY * gridWidth;
    let cellArray = previousGrid[cellIndex];

    if (!cellArray || cellArray.length !== BLOB_CACHE_GRID_SIZE * BLOB_CACHE_GRID_SIZE) {
      cellArray = new Uint8Array(BLOB_CACHE_GRID_SIZE * BLOB_CACHE_GRID_SIZE);
    } else {
      cellArray.fill(0);
    }

    nextGrid[cellIndex] = cellArray;

    const cellWorldX = cacheStartX + cellX * BLOB_CACHE_GRID_SIZE;
    const cellWorldY = startY + cellY * BLOB_CACHE_GRID_SIZE;
    const minSpatialX = Math.floor((cellWorldX - BLOB_RADIUS) / cellSize);
    const maxSpatialX = Math.floor((cellWorldX + BLOB_CACHE_GRID_SIZE + BLOB_RADIUS) / cellSize);
    const minSpatialY = Math.floor((cellWorldY - BLOB_RADIUS) / cellSize);
    const maxSpatialY = Math.floor((cellWorldY + BLOB_CACHE_GRID_SIZE + BLOB_RADIUS) / cellSize);
    const spatialCellsToCheck: string[] = [];

    for (let spatialY = minSpatialY; spatialY <= maxSpatialY; spatialY += 1) {
      for (let spatialX = minSpatialX; spatialX <= maxSpatialX; spatialX += 1) {
        const spatialKey = `${spatialX},${spatialY}`;
        if (spatialGrid[spatialKey]) {
          spatialCellsToCheck.push(spatialKey);
        }
      }
    }

    if (!spatialCellsToCheck.length) {
      continue;
    }

    for (let localY = 0; localY < BLOB_CACHE_GRID_SIZE; localY += 1) {
      const rowOffset = localY * BLOB_CACHE_GRID_SIZE;
      const worldY = cellWorldY + localY;

      for (let localX = 0; localX < BLOB_CACHE_GRID_SIZE; localX += 1) {
        const worldX = cellWorldX + localX;
        const arrayIndex = rowOffset + localX;
        let isInterior = false;
        let isBorder = false;

        for (let spatialIndex = 0; spatialIndex < spatialCellsToCheck.length; spatialIndex += 1) {
          const positions = spatialGrid[spatialCellsToCheck[spatialIndex]];

          for (let positionIndex = 0; positionIndex < positions.length; positionIndex += 1) {
            const position = positions[positionIndex];
            const dx = worldX - position.x;
            const dy = worldY - position.y;
            const distanceSquared = dx * dx + dy * dy * 1.5;

            if (distanceSquared < (BLOB_RADIUS - 1.5) * (BLOB_RADIUS - 1.5)) {
              isInterior = true;
              break;
            }
            if (distanceSquared < BLOB_RADIUS * BLOB_RADIUS) {
              isBorder = true;
            }
          }

          if (isInterior) {
            break;
          }
        }

        cellArray[arrayIndex] = isInterior ? 1 : (isBorder ? 2 : 0);
      }
    }
  }

  return {
    grid: nextGrid,
    startX: cacheStartX,
    startY,
    width: cacheWidth,
    height,
    cacheGridWidth: gridWidth
  };
};

export const useBlobCache = (
  textPositionCache: TextPositionCacheResult,
  size: Size
) => {
  const blobGridCache = useRef<BlobGridCache>(createEmptyBlobCache());
  const spatialGridRef = useRef<SpatialGrid>({});
  const needsRebuildRef = useRef(true);
  const rebuildCacheTimeoutRef = useRef<number | null>(null);

  const buildBlobCache = useCallback(() => {
    if (!size.width || !size.height) {
      blobGridCache.current = createEmptyBlobCache();
      needsRebuildRef.current = false;
      return;
    }

    const { cols, rows } = getGridDimensions(size.width, size.height);
    const paddingMultiplier = IS_SAFARI ? SAFARI_BLOB_PADDING_MULTIPLIER : BLOB_PADDING_MULTIPLIER;
    const padding = Math.max(1, Math.round(BLOB_RADIUS * paddingMultiplier));

    let scrollMinY = Number.POSITIVE_INFINITY;
    let scrollMaxY = Number.NEGATIVE_INFINITY;

    for (const textKey in textPositionCache.bounds) {
      const textBounds = textPositionCache.bounds[textKey];
      if (!textBounds || textBounds.fixed) {
        continue;
      }
      scrollMinY = Math.min(scrollMinY, textBounds.minY);
      scrollMaxY = Math.max(scrollMaxY, textBounds.maxY);
    }

    const fixedPlane = buildPlane({
      bounds: textPositionCache.bounds,
      cache: textPositionCache.cache,
      cols,
      includeFixed: true,
      startY: -padding,
      height: rows + padding * 2,
      previousPlane: blobGridCache.current.fixed
    });

    const hasScrollContent = scrollMinY !== Number.POSITIVE_INFINITY && scrollMaxY !== Number.NEGATIVE_INFINITY;
    const scrollStartY = hasScrollContent ? Math.floor(scrollMinY) - padding : 0;
    const scrollHeight = hasScrollContent ? Math.ceil(scrollMaxY) - scrollStartY + 1 + padding : 0;
    const scrollPlane = buildPlane({
      bounds: textPositionCache.bounds,
      cache: textPositionCache.cache,
      cols,
      includeFixed: false,
      startY: scrollStartY,
      height: scrollHeight,
      previousPlane: blobGridCache.current.scroll
    });

    blobGridCache.current = {
      fixed: fixedPlane,
      scroll: scrollPlane
    };
    needsRebuildRef.current = false;
  }, [size.height, size.width, textPositionCache.bounds, textPositionCache.cache]);

  return {
    blobGridCache,
    spatialGridRef,
    needsRebuildRef,
    rebuildCacheTimeoutRef,
    buildBlobCache
  };
};
