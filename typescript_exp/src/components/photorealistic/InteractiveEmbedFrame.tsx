import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { normalizePhotoVideoEmbedSrc, primePhotoVideoEmbedPlayback } from './videoPlayback';

type InteractiveEmbedFrameProps = {
  src: string;
  label: string;
  style: CSSProperties;
  isVisible: boolean;
  onForwardWheel: (event: WheelEvent) => void;
};

const hintStyle: CSSProperties = {
  position: 'absolute',
  top: 12,
  right: 12,
  zIndex: 2,
  padding: '6px 8px',
  backgroundColor: 'rgba(255, 255, 255, 0.92)',
  color: 'black',
  border: '1px solid rgba(0, 0, 0, 0.18)',
  fontFamily: 'monospace',
  fontSize: 10,
  lineHeight: 1.2,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  pointerEvents: 'none',
  userSelect: 'none'
};

const isPointInsideNode = (node: HTMLElement, clientX: number, clientY: number) => {
  const rect = node.getBoundingClientRect();
  return (
    clientX >= rect.left
    && clientX <= rect.right
    && clientY >= rect.top
    && clientY <= rect.bottom
  );
};

const InteractiveEmbedFrame = ({
  src,
  label,
  style,
  isVisible,
  onForwardWheel
}: InteractiveEmbedFrameProps) => {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [isInteractive, setIsInteractive] = useState(false);
  const playbackSrc = useMemo(() => normalizePhotoVideoEmbedSrc(src), [src]);

  useEffect(() => {
    const node = frameRef.current;
    if (!node) {
      return;
    }

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      onForwardWheel(event);
    };

    node.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      node.removeEventListener('wheel', handleWheel);
    };
  }, [onForwardWheel]);

  useEffect(() => {
    if (!isVisible) {
      setIsInteractive(false);
    }
  }, [isVisible]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !isVisible) {
      return;
    }

    let cancelPlaybackPrime = () => {};
    const requestPlayback = () => {
      cancelPlaybackPrime();
      cancelPlaybackPrime = primePhotoVideoEmbedPlayback(iframe);
    };

    requestPlayback();
    iframe.addEventListener('load', requestPlayback);

    return () => {
      iframe.removeEventListener('load', requestPlayback);
      cancelPlaybackPrime();
    };
  }, [isVisible, playbackSrc]);

  useEffect(() => {
    if (!isInteractive) {
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      const node = frameRef.current;
      if (!node || !isPointInsideNode(node, event.clientX, event.clientY)) {
        setIsInteractive(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsInteractive(false);
      }
    };

    document.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isInteractive]);

  return (
    <div
      ref={frameRef}
      data-photo-video="true"
      style={{
        ...style,
        cursor: isInteractive ? 'auto' : 'pointer'
      }}
      onClick={event => {
        if (isInteractive) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        setIsInteractive(true);
      }}
      onMouseLeave={() => setIsInteractive(false)}
      title={isInteractive ? 'Move away to resume scrolling' : 'Click to interact with video'}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'black'
        }}
      />
      {!isInteractive && (
        <button
          type="button"
          aria-label={`Interact with ${label}`}
          onClick={event => {
            event.preventDefault();
            event.stopPropagation();
            setIsInteractive(true);
          }}
          onWheel={event => {
            event.preventDefault();
            event.stopPropagation();
            onForwardWheel(event.nativeEvent);
          }}
          onTouchStart={event => {
            event.preventDefault();
            event.stopPropagation();
            setIsInteractive(true);
          }}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 1,
            border: 0,
            padding: 0,
            margin: 0,
            background: 'transparent',
            cursor: 'pointer'
          }}
        />
      )}
      <div style={hintStyle}>
        {isInteractive ? 'Move away to scroll' : 'Click to interact'}
      </div>
      <iframe
        ref={iframeRef}
        src={playbackSrc}
        title={label}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          border: 0,
          pointerEvents: isInteractive ? 'auto' : 'none'
        }}
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
        loading="eager"
      />
    </div>
  );
};

export default InteractiveEmbedFrame;
