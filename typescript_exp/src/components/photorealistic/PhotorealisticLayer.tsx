import React, { useState, useCallback, useEffect, useRef } from 'react';
import { getCurrentCharMetrics } from '../ascii-art2/constants';
import { TextBounds } from '../ascii-art2/types';

export type PhotoContentInsets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

type PhotoLayerBase = {
  id: string;
  anchorName: string;
  alt: string;
  filter?: string;
  offsetX?: number;
  offsetY?: number;
  scaleX?: number;
  scaleY?: number;
  stretchX?: number;
  stretchY?: number;
  boundsSource?: 'raw' | 'padded';
  objectFit?: React.CSSProperties['objectFit'];
  contentInsets?: PhotoContentInsets;
  fixed?: boolean;
};

export type PhotoLayerItem =
  | (PhotoLayerBase & {
    mediaType?: 'image';
    lowSrc: string;
    highSrc: string;
  })
  | (PhotoLayerBase & {
    mediaType: 'video';
    kind: 'embed';
    embedSrc: string;
  })
  | (PhotoLayerBase & {
    mediaType: 'video';
    kind: 'file';
    videoSrc: string;
    autoplay?: boolean;
    loop?: boolean;
    muted?: boolean;
    controls?: boolean;
    playsInline?: boolean;
    poster?: string;
  });

export type PhotorealisticLayout = {
  rawBounds: Record<string, TextBounds>;
  paddedBounds: Record<string, TextBounds>;
};

export type PhotoPixelRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type PhotorealisticLayerProps = {
  items: PhotoLayerItem[];
  layout: PhotorealisticLayout;
  scrollOffset: number;
  isVisible: boolean;
  showHighRes: boolean;
  isInteractive: boolean;
  opacity?: number;
  opacityTransition?: string;
  onLayerClick?: (origin: { x: number; y: number }) => void;
  onLayerTouchEnd?: (origin: { x: number; y: number }) => void;
  onForwardWheel?: (event: WheelEvent) => void;
  zIndex?: number;
};

const clampInset = (value: number) => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(0.95, Math.max(0, value));
};

export const normalizePhotoContentInsets = (insets?: PhotoContentInsets) => {
  if (!insets) {
    return undefined;
  }

  let left = clampInset(insets.left);
  let right = clampInset(insets.right);
  let top = clampInset(insets.top);
  let bottom = clampInset(insets.bottom);

  const horizontalTotal = left + right;
  if (horizontalTotal >= 0.95) {
    const scale = 0.95 / horizontalTotal;
    left *= scale;
    right *= scale;
  }

  const verticalTotal = top + bottom;
  if (verticalTotal >= 0.95) {
    const scale = 0.95 / verticalTotal;
    top *= scale;
    bottom *= scale;
  }

  if (left === 0 && right === 0 && top === 0 && bottom === 0) {
    return undefined;
  }

  return { top, right, bottom, left };
};

export const resolvePhotoCropFrameStyle = (
  insets?: PhotoContentInsets
): React.CSSProperties | undefined => {
  const normalizedInsets = normalizePhotoContentInsets(insets);
  if (!normalizedInsets) {
    return undefined;
  }

  const visibleWidth = 1 - normalizedInsets.left - normalizedInsets.right;
  const visibleHeight = 1 - normalizedInsets.top - normalizedInsets.bottom;
  const cropScale = Math.max(1 / visibleWidth, 1 / visibleHeight);
  const centerX = normalizedInsets.left + visibleWidth / 2;
  const centerY = normalizedInsets.top + visibleHeight / 2;

  return {
    position: 'absolute',
    width: `${cropScale * 100}%`,
    height: `${cropScale * 100}%`,
    left: `${(0.5 - centerX * cropScale) * 100}%`,
    top: `${(0.5 - centerY * cropScale) * 100}%`
  };
};

export const resolvePhotoItemPixelRect = (
  item: PhotoLayerItem,
  layout: PhotorealisticLayout,
  metrics = getCurrentCharMetrics()
): PhotoPixelRect | null => {
  const boundsMap = item.boundsSource === 'padded' ? layout.paddedBounds : layout.rawBounds;
  const bounds = boundsMap[item.anchorName];
  if (!bounds) {
    return null;
  }

  const widthChars = bounds.maxX - bounds.minX + 1;
  const heightChars = bounds.maxY - bounds.minY + 1;
  const scaleX = item.scaleX ?? 1;
  const scaleY = item.scaleY ?? 1;

  return {
    left: (bounds.minX + (item.offsetX ?? 0)) * metrics.charWidth,
    top: (bounds.minY + (item.offsetY ?? 0)) * metrics.charHeight,
    width: widthChars * metrics.charWidth * scaleX,
    height: heightChars * metrics.charHeight * scaleY
  };
};

const PhotorealisticLayer: React.FC<PhotorealisticLayerProps> = ({
  items,
  layout,
  scrollOffset,
  isVisible,
  showHighRes,
  isInteractive,
  opacity,
  opacityTransition,
  onLayerClick,
  onLayerTouchEnd,
  onForwardWheel,
  zIndex = 2
}) => {
  const { charWidth, charHeight } = getCurrentCharMetrics();
  const [loadedHighRes, setLoadedHighRes] = useState<Set<string>>(() => new Set());
  const inputShieldRef = useRef<HTMLDivElement | null>(null);
  const suppressClickUntilRef = useRef(0);
  const touchGestureRef = useRef({
    active: false,
    identifier: -1,
    lastY: 0,
    moved: false
  });

  const markHighResLoaded = useCallback((id: string) => {
    setLoadedHighRes(prev => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const renderItem = (item: PhotoLayerItem) => {
    const boundsMap = item.boundsSource === 'padded' ? layout.paddedBounds : layout.rawBounds;
    const bounds = boundsMap[item.anchorName];
    if (!bounds) {
      return null;
    }

    const widthChars = bounds.maxX - bounds.minX + 1;
    const heightChars = bounds.maxY - bounds.minY + 1;
    const scaleX = item.scaleX ?? 1;
    const scaleY = item.scaleY ?? 1;
    const stretchX = item.stretchX ?? 1;
    const stretchY = item.stretchY ?? 1;

    const width = widthChars * charWidth * scaleX;
    const height = heightChars * charHeight * scaleY;
    const left = (bounds.minX + (item.offsetX ?? 0)) * charWidth;
    const top = (bounds.minY + (item.offsetY ?? 0)) * charHeight;

    const baseStyle: React.CSSProperties = {
      position: 'absolute',
      left,
      top,
      width,
      height,
      overflow: 'hidden',
      zIndex: item.mediaType === 'video' ? 2 : 0,
      pointerEvents: item.mediaType === 'video' && isInteractive ? 'auto' : 'none'
    };

    if (item.mediaType === 'video') {
      const background = (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'black'
          }}
        />
      );
      if (item.kind === 'embed') {
        return (
          <div key={item.id} data-photo-video="true" style={baseStyle}>
            {background}
            <iframe
              src={item.embedSrc}
              title={item.alt}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                border: 0
              }}
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              loading="eager"
            />
          </div>
        );
      }

      const controls = item.controls ?? true;
      const playsInline = item.playsInline ?? true;
      return (
        <div key={item.id} data-photo-video="true" style={baseStyle}>
          {background}
          <video
            src={item.videoSrc}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: item.objectFit ?? 'cover'
            }}
            autoPlay={Boolean(item.autoplay)}
            loop={Boolean(item.loop)}
            muted={Boolean(item.muted)}
            controls={controls}
            playsInline={playsInline}
            preload="metadata"
          />
        </div>
      );
    }

    const isHighResLoaded = loadedHighRes.has(item.id);
    const shouldShowHighRes = showHighRes;
    const showLowRes = !shouldShowHighRes || !isHighResLoaded;
    const cropFrameStyle = resolvePhotoCropFrameStyle(item.contentInsets);
    const lowFilter = ['blur(6px)', item.filter].filter(Boolean).join(' ');
    const lowStyle: React.CSSProperties = {
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      objectFit: item.objectFit ?? 'cover',
      imageRendering: 'pixelated',
      filter: lowFilter,
      transform: `scale(${1.01 * stretchX}, ${1.01 * stretchY})`,
      transformOrigin: 'center',
      opacity: shouldShowHighRes && isHighResLoaded ? 0 : 1,
      transition: 'opacity 0.4s ease',
      willChange: 'opacity'
    };

    const highStyle: React.CSSProperties = {
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      objectFit: item.objectFit ?? 'cover',
      filter: item.filter,
      transform: `scale(${stretchX}, ${stretchY})`,
      transformOrigin: 'center',
      opacity: shouldShowHighRes && isHighResLoaded ? 1 : 0,
      transition: 'opacity 0.6s ease',
      willChange: 'opacity'
    };

    const renderImage = (
      src: string,
      style: React.CSSProperties,
      onLoad?: () => void
    ) => {
      const image = (
        <img
          src={src}
          alt={item.alt}
          style={style}
          loading="eager"
          decoding="async"
          onLoad={onLoad}
        />
      );

      if (!cropFrameStyle) {
        return image;
      }

      return (
        <div data-photo-crop-frame="true" style={cropFrameStyle}>
          {image}
        </div>
      );
    };

    return (
      <div key={item.id} data-photo-image="true" style={baseStyle}>
        {showLowRes && renderImage(item.lowSrc, lowStyle)}
        {shouldShowHighRes && renderImage(item.highSrc, highStyle, () => markHighResLoaded(item.id))}
      </div>
    );
  };

  const scrolledItems = items.filter(item => !item.fixed);
  const fixedItems = items.filter(item => item.fixed);
  const effectiveOpacity = typeof opacity === 'number' ? opacity : (isVisible ? 1 : 0);
  const transition = opacityTransition ?? (isVisible ? 'opacity 0.2s ease' : 'opacity 0s');

  useEffect(() => {
    const node = inputShieldRef.current;
    if (!node || !isInteractive) {
      touchGestureRef.current = {
        active: false,
        identifier: -1,
        lastY: 0,
        moved: false
      };
      return;
    }

    const handleClick = (event: MouseEvent) => {
      if (performance.now() < suppressClickUntilRef.current || !onLayerClick) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      onLayerClick({ x: event.clientX, y: event.clientY });
    };

    const handleWheel = (event: WheelEvent) => {
      if (!onForwardWheel) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      onForwardWheel(event);
    };

    const resetTouchGesture = () => {
      touchGestureRef.current = {
        active: false,
        identifier: -1,
        lastY: 0,
        moved: false
      };
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        resetTouchGesture();
        return;
      }
      const touch = event.touches[0];
      touchGestureRef.current = {
        active: true,
        identifier: touch.identifier,
        lastY: touch.clientY,
        moved: false
      };
    };

    const handleTouchMove = (event: TouchEvent) => {
      const gesture = touchGestureRef.current;
      if (!gesture.active || event.touches.length !== 1) {
        return;
      }
      const touch = event.touches[0];
      if (touch.identifier !== gesture.identifier) {
        return;
      }
      const deltaY = gesture.lastY - touch.clientY;
      if (Math.abs(deltaY) > 0.5) {
        gesture.moved = true;
      }
      gesture.lastY = touch.clientY;
      if (!onForwardWheel || Math.abs(deltaY) <= 0.5) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      onForwardWheel(new WheelEvent('wheel', {
        deltaY,
        bubbles: true,
        cancelable: true
      }));
    };

    const handleTouchEnd = (event: TouchEvent) => {
      const gesture = touchGestureRef.current;
      if (!gesture.active) {
        return;
      }
      const touch = Array.from(event.changedTouches).find(candidate => candidate.identifier === gesture.identifier);
      const shouldExit = !gesture.moved && Boolean(onLayerTouchEnd) && Boolean(touch);
      resetTouchGesture();
      if (!shouldExit || !touch || !onLayerTouchEnd) {
        return;
      }
      suppressClickUntilRef.current = performance.now() + 400;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      onLayerTouchEnd({ x: touch.clientX, y: touch.clientY });
    };

    node.addEventListener('click', handleClick, { capture: true });
    node.addEventListener('wheel', handleWheel, { capture: true, passive: false });
    node.addEventListener('touchstart', handleTouchStart, { capture: true, passive: true });
    node.addEventListener('touchmove', handleTouchMove, { capture: true, passive: false });
    node.addEventListener('touchend', handleTouchEnd, { capture: true, passive: false });
    node.addEventListener('touchcancel', resetTouchGesture, { capture: true });

    return () => {
      node.removeEventListener('click', handleClick, { capture: true });
      node.removeEventListener('wheel', handleWheel, { capture: true });
      node.removeEventListener('touchstart', handleTouchStart, { capture: true });
      node.removeEventListener('touchmove', handleTouchMove, { capture: true });
      node.removeEventListener('touchend', handleTouchEnd, { capture: true });
      node.removeEventListener('touchcancel', resetTouchGesture, { capture: true });
    };
  }, [isInteractive, onForwardWheel, onLayerClick, onLayerTouchEnd]);

  return (
    <div
      data-photorealistic-layer="true"
      data-photorealistic-visible={effectiveOpacity > 0.01 ? 'true' : 'false'}
      data-photorealistic-interactive={isInteractive ? 'true' : 'false'}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'white',
        opacity: effectiveOpacity,
        pointerEvents: isInteractive ? 'auto' : 'none',
        transition,
        overflow: 'hidden',
        zIndex,
        willChange: 'opacity'
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `translate3d(0, ${-scrollOffset}px, 0)`,
          willChange: 'transform'
        }}
      >
        {scrolledItems.map(renderItem)}
      </div>
      {fixedItems.length > 0 && (
        <div style={{ position: 'absolute', inset: 0 }}>
          {fixedItems.map(renderItem)}
        </div>
      )}
      <div
        ref={inputShieldRef}
        data-photo-input-shield="true"
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          pointerEvents: isInteractive ? 'auto' : 'none',
          background: 'transparent',
          touchAction: 'none'
        }}
      />
    </div>
  );
};

export default PhotorealisticLayer;
