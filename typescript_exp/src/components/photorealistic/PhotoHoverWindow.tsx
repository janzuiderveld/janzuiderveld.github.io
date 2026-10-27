import React, { useEffect, useRef } from 'react';
import { BLOB_RADIUS, getCurrentCharMetrics } from '../ascii-art2/constants';
import {
  PhotoLayerItem,
  PhotorealisticLayout,
  resolvePhotoCropFrameStyle
} from './PhotorealisticLayer';

type PhotoHoverWindowProps = {
  item: PhotoLayerItem | null;
  layout: PhotorealisticLayout;
  scrollOffset: number;
  cursorRef: React.MutableRefObject<{ x: number; y: number }>;
  isTouchRef: React.MutableRefObject<boolean>;
  isActive: boolean;
};

const POINT_COUNT = 16;
const SMOOTHING = 0.18;
const NOISE_SCALE = 0.18;
const MIN_RADIUS = 110;
const RADIUS_SCALE = 4;
const TOUCH_RADIUS = 680;

export const getPhotoHoverRadiusPx = (isTouch = false) => {
  const { charWidth } = getCurrentCharMetrics();
  const radius = Math.max(charWidth * BLOB_RADIUS * RADIUS_SCALE, MIN_RADIUS * RADIUS_SCALE);
  return isTouch ? TOUCH_RADIUS : radius;
};

// An exact damped spring step keeps the response consistent at any frame rate.
const advanceReveal = (amount: number, velocity: number, target: number, seconds: number) => {
  const stiffness = target ? 225 : 420;
  const damping = target ? 20 : 30;
  const decayRate = damping / 2;
  const frequency = Math.sqrt(stiffness - decayRate * decayRate);
  const displacement = amount - target;
  const decay = Math.exp(-decayRate * seconds);
  const sine = Math.sin(frequency * seconds);
  const cosine = Math.cos(frequency * seconds);
  return {
    amount: target + decay * (displacement * cosine + (velocity + decayRate * displacement) / frequency * sine),
    velocity: decay * (velocity * cosine - (decayRate * velocity + stiffness * displacement) / frequency * sine)
  };
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
  isTouchRef,
  isActive
}) => {
  const clipRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const smoothPositionRef = useRef({ x: 0, y: 0 });
  const revealRef = useRef({ amount: 0, velocity: 0 });
  const previousTouchRef = useRef(false);

  useEffect(() => {
    if (!clipRef.current) {
      revealRef.current = { amount: 0, velocity: 0 };
      return undefined;
    }

    const element = clipRef.current;
    if (isActive && revealRef.current.amount === 0) {
      smoothPositionRef.current = { ...cursorRef.current };
    }
    let running = true;
    let previousTime: number | null = null;

    const tick = (time: number) => {
      if (!running) return;
      const isTouch = isTouchRef.current;
      if (isTouch !== previousTouchRef.current) {
        revealRef.current = { amount: 0, velocity: 0 };
        previousTouchRef.current = isTouch;
        previousTime = null;
      }
      const target = cursorRef.current;
      const smooth = smoothPositionRef.current;
      smooth.x += (target.x - smooth.x) * SMOOTHING;
      smooth.y += (target.y - smooth.y) * SMOOTHING;

      let baseRadius = isActive ? getPhotoHoverRadiusPx() : 0;
      if (isTouch) {
        const elapsed = previousTime === null ? 0 : Math.min((time - previousTime) / 1000, 0.1);
        const reveal = advanceReveal(revealRef.current.amount, revealRef.current.velocity, isActive ? 1 : 0, elapsed);
        if ((!isActive && reveal.amount <= 0) || document.hidden) {
          reveal.amount = 0;
          reveal.velocity = 0;
        }
        revealRef.current = reveal;
        // Hit testing uses this same fixed radius, even far from the artwork.
        baseRadius = getPhotoHoverRadiusPx(true) * Math.max(0, reveal.amount);
      }
      previousTime = time;
      const polygon = buildBlobPolygon(smooth.x, smooth.y, baseRadius, time);
      const clipPath = `polygon(${polygon})`;
      element.style.clipPath = clipPath;
      element.style.setProperty('-webkit-clip-path', clipPath);

      if (!document.hidden && (isActive || (isTouch && revealRef.current.amount > 0))) {
        animationRef.current = requestAnimationFrame(tick);
      } else {
        animationRef.current = null;
      }
    };

    animationRef.current = requestAnimationFrame(tick);

    return () => {
      running = false;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      animationRef.current = null;
    };
  }, [cursorRef, isTouchRef, isActive, item?.id]);

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
  const cropFrameStyle = resolvePhotoCropFrameStyle(item.contentInsets);
  const image = (
    <img
      src={item.highSrc}
      alt={item.alt}
      loading="eager"
      decoding="async"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: item.objectFit ?? 'cover',
        filter: item.filter,
        transform: `scale(${stretchX}, ${stretchY})`,
        transformOrigin: 'center',
        opacity: 1
      }}
    />
  );

  return (
    <div
      data-photo-peek
      data-photo-peek-active={isActive}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 3,
        pointerEvents: 'none',
        opacity: isActive || isTouchRef.current ? 1 : 0,
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
          <div
            style={{
              position: 'absolute',
              left,
              top,
              width,
              height,
              overflow: 'hidden'
            }}
          >
            {cropFrameStyle ? (
              <div style={cropFrameStyle}>
                {image}
              </div>
            ) : (
              image
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhotoHoverWindow;
