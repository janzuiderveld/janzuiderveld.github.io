import React, { useState, useCallback } from 'react';
import { getCurrentCharMetrics } from '../ascii-art2/constants';
import { TextBounds } from '../ascii-art2/types';

type PhotoLayerBase = {
  id: string;
  anchorName: string;
  alt: string;
  offsetX?: number;
  offsetY?: number;
  scaleX?: number;
  scaleY?: number;
  boundsSource?: 'raw' | 'padded';
  objectFit?: React.CSSProperties['objectFit'];
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
    embedSrc: string;
  });

export type PhotorealisticLayout = {
  rawBounds: Record<string, TextBounds>;
  paddedBounds: Record<string, TextBounds>;
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
};

const PhotorealisticLayer: React.FC<PhotorealisticLayerProps> = ({
  items,
  layout,
  scrollOffset,
  isVisible,
  showHighRes,
  isInteractive,
  opacity,
  opacityTransition
}) => {
  const { charWidth, charHeight } = getCurrentCharMetrics();
  const [loadedHighRes, setLoadedHighRes] = useState<Set<string>>(() => new Set());

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
      overflow: 'hidden'
    };

    if (item.mediaType === 'video') {
      return (
        <div key={item.id} style={baseStyle}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'black'
            }}
          />
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

    const isHighResLoaded = loadedHighRes.has(item.id);
    const shouldShowHighRes = showHighRes;
    const showLowRes = !shouldShowHighRes || !isHighResLoaded;
    const lowStyle: React.CSSProperties = {
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      objectFit: item.objectFit ?? 'cover',
      imageRendering: 'pixelated',
      filter: 'blur(6px)',
      transform: 'scale(1.01)',
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
      opacity: shouldShowHighRes && isHighResLoaded ? 1 : 0,
      transition: 'opacity 0.6s ease',
      willChange: 'opacity'
    };

    return (
      <div key={item.id} style={baseStyle}>
        {showLowRes && (
          <img src={item.lowSrc} alt={item.alt} style={lowStyle} loading="eager" decoding="async" />
        )}
        {shouldShowHighRes && (
          <img
            src={item.highSrc}
            alt={item.alt}
            style={highStyle}
            loading="eager"
            decoding="async"
            onLoad={() => markHighResLoaded(item.id)}
          />
        )}
      </div>
    );
  };

  const scrolledItems = items.filter(item => !item.fixed);
  const fixedItems = items.filter(item => item.fixed);
  const effectiveOpacity = typeof opacity === 'number' ? opacity : (isVisible ? 1 : 0);
  const transition = opacityTransition ?? (isVisible ? 'opacity 0.2s ease' : 'opacity 0s');

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'white',
        opacity: effectiveOpacity,
        pointerEvents: isInteractive ? 'auto' : 'none',
        transition,
        overflow: 'hidden',
        zIndex: 2,
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
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {fixedItems.map(renderItem)}
        </div>
      )}
    </div>
  );
};

export default PhotorealisticLayer;
