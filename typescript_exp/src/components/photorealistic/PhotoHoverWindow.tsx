import React, { useEffect, useRef } from 'react';
import { BLOB_RADIUS, getCurrentCharMetrics } from '../ascii-art2/constants';
import { PhotoLayerItem, PhotorealisticLayout } from './PhotorealisticLayer';

type PhotoHoverWindowProps = {
  item: PhotoLayerItem | null;
  layout: PhotorealisticLayout;
  scrollOffset: number;
  cursorRef: React.MutableRefObject<{ x: number; y: number }>;
  isActive: boolean;
};

const POINT_COUNT = 16;
const SMOOTHING = 0.18;
const NOISE_SCALE = 0.18;
const MIN_RADIUS = 110;
const RADIUS_SCALE = 4;

export const getPhotoHoverRadiusPx = () => {
  const { charWidth } = getCurrentCharMetrics();
  return Math.max(charWidth * BLOB_RADIUS * RADIUS_SCALE, MIN_RADIUS * RADIUS_SCALE);
};

const buildBlobPolygon = (centerX: number, centerY: number, radius: number, time: number) => {
  const points: string[] = [];
  const timeFactor = time * 0.001;
  const pulse = 1 + Math.sin(timeFactor * 2) * 0.05;

  for (let i = 0; i < POINT_COUNT; i += 1) {
    const angle = (i / POINT_COUNT) * Math.PI * 2;
    const wave1 = Math.sin(angle * 2 + timeFactor * 1.3);
    const wave2 = Math.cos(angle * 3 - timeFactor * 0.9);
    const wave3 = Math.sin(angle * 5 + timeFactor * 0.7);
    const wobble = (wave1 * 0.5 + wave2 * 0.3 + wave3 * 0.2) * NOISE_SCALE;
    const currentRadius = radius * pulse * (1 + wobble);
    const x = centerX + Math.cos(angle) * currentRadius;
    const y = centerY + Math.sin(angle) * currentRadius;
    points.push(`${x.toFixed(1)}px ${y.toFixed(1)}px`);
  }

  return points.join(', ');
};

const PhotoHoverWindow: React.FC<PhotoHoverWindowProps> = ({
  item,
  layout,
  scrollOffset,
  cursorRef,
  isActive
}) => {
  const clipRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const smoothPositionRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!isActive || !clipRef.current) {
      return undefined;
    }

    const element = clipRef.current;
    const start = cursorRef.current;
    smoothPositionRef.current = { x: start.x, y: start.y };

    const tick = (time: number) => {
      const target = cursorRef.current;
      const smooth = smoothPositionRef.current;
      smooth.x += (target.x - smooth.x) * SMOOTHING;
      smooth.y += (target.y - smooth.y) * SMOOTHING;

      const baseRadius = getPhotoHoverRadiusPx();
      const polygon = buildBlobPolygon(smooth.x, smooth.y, baseRadius, time);
      const clipPath = `polygon(${polygon})`;
      element.style.clipPath = clipPath;
      element.style.setProperty('-webkit-clip-path', clipPath);

      animationRef.current = requestAnimationFrame(tick);
    };

    animationRef.current = requestAnimationFrame(tick);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      animationRef.current = null;
    };
  }, [cursorRef, isActive]);

  if (!item || item.mediaType === 'video') {
    return null;
  }

  const boundsMap = item.boundsSource === 'padded' ? layout.paddedBounds : layout.rawBounds;
  const bounds = boundsMap[item.anchorName];
  if (!bounds) {
    return null;
  }

  const { charWidth, charHeight } = getCurrentCharMetrics();
  const scaleX = item.scaleX ?? 1;
  const scaleY = item.scaleY ?? 1;
  const stretchX = item.stretchX ?? 1;
  const stretchY = item.stretchY ?? 1;
  const width = (bounds.maxX - bounds.minX + 1) * charWidth * scaleX;
  const height = (bounds.maxY - bounds.minY + 1) * charHeight * scaleY;
  const left = (bounds.minX + (item.offsetX ?? 0)) * charWidth;
  const top = (bounds.minY + (item.offsetY ?? 0)) * charHeight;
  const isFixed = item.fixed ?? bounds.fixed;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 3,
        pointerEvents: 'none',
        opacity: isActive ? 1 : 0,
        transition: 'opacity 0.2s ease'
      }}
    >
      <div
        ref={clipRef}
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 1,
          filter: 'saturate(1.05)',
          clipPath: 'circle(0 at 0 0)',
          WebkitClipPath: 'circle(0 at 0 0)',
          willChange: 'clip-path'
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            transform: isFixed ? 'none' : `translate3d(0, ${-scrollOffset}px, 0)`,
            willChange: isFixed ? 'auto' : 'transform'
          }}
        >
          <img
            src={item.highSrc}
            alt={item.alt}
            loading="eager"
            decoding="async"
            style={{
              position: 'absolute',
              left,
              top,
              width,
              height,
              objectFit: item.objectFit ?? 'cover',
              transform: `scale(${stretchX}, ${stretchY})`,
              transformOrigin: 'center',
              opacity: 1
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default PhotoHoverWindow;
