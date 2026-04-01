import { PhotoLayerItem, PhotorealisticLayout } from './PhotorealisticLayer';

type ResolvePhotoItemAtPointArgs = {
  items: PhotoLayerItem[];
  layout: PhotorealisticLayout;
  clientX: number;
  clientY: number;
  radiusPx: number;
  charWidth: number;
  charHeight: number;
  scrollOffsetPx: number;
};

export const resolvePhotoItemAtPoint = ({
  items,
  layout,
  clientX,
  clientY,
  radiusPx,
  charWidth,
  charHeight,
  scrollOffsetPx
}: ResolvePhotoItemAtPointArgs): PhotoLayerItem | null => {
  if (!items.length || !charWidth || !charHeight) {
    return null;
  }

  const radiusSquared = radiusPx * radiusPx;

  for (const item of items) {
    const boundsMap = item.boundsSource === 'padded' ? layout.paddedBounds : layout.rawBounds;
    const bounds = boundsMap[item.anchorName];
    if (!bounds) {
      continue;
    }

    const scaleX = item.scaleX ?? 1;
    const scaleY = item.scaleY ?? 1;
    const left = (bounds.minX + (item.offsetX ?? 0)) * charWidth;
    const top = (bounds.minY + (item.offsetY ?? 0)) * charHeight;
    const width = (bounds.maxX - bounds.minX + 1) * charWidth * scaleX;
    const height = (bounds.maxY - bounds.minY + 1) * charHeight * scaleY;
    const isFixed = item.fixed ?? bounds.fixed;
    const rectLeft = left;
    const rectTop = isFixed ? top : top - scrollOffsetPx;
    const rectRight = rectLeft + width;
    const rectBottom = rectTop + height;
    const dx = Math.max(rectLeft - clientX, 0, clientX - rectRight);
    const dy = Math.max(rectTop - clientY, 0, clientY - rectBottom);

    if (dx * dx + dy * dy <= radiusSquared) {
      return item;
    }
  }

  return null;
};
