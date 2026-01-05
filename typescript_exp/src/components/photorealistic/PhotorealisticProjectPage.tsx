import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import AsciiArtGenerator from '../ascii-art2/AsciiArtGenerator';
import { AsciiLayoutInfo, TextContentItem } from '../ascii-art2/types';
import { CHAR_HEIGHT, IS_SAFARI } from '../ascii-art2/constants';
import PhotorealisticLayer, {
  PhotoLayerItem,
  PhotorealisticLayout
} from './PhotorealisticLayer';

const PHOTO_EXIT_FADE_DURATION = 1000;
const PHOTO_EXIT_WHITEIN_START = 0.45;
const PHOTO_ENTER_FADE_DURATION = PHOTO_EXIT_FADE_DURATION;

export type PhotoTransform = {
  offsetX: number;
  offsetY: number;
  scaleX: number;
  scaleY: number;
  stretchX?: number;
  stretchY?: number;
};

type PhotoState = 'ascii' | 'entering' | 'photo' | 'exiting';

type PhotorealisticProjectPageProps = {
  title: string;
  bodyText: string;
  asciiArt: string;
  artName: string;
  photo: {
    src: string;
    alt: string;
  };
  alignment?: PhotoTransform;
  asciiAnchorOffsetY?: number;
};

type NavigatorWithTouch = Navigator & { maxTouchPoints?: number };

type WhiteInRequest = {
  position: { x: number; y: number };
  token: number;
  startProgress?: number;
};

const DEFAULT_PHOTO_TRANSFORM: PhotoTransform = {
  offsetX: 0,
  offsetY: 0,
  scaleX: 1,
  scaleY: 1,
  stretchX: 1,
  stretchY: 1
};

const isMobileDevice = () => {
  if (typeof navigator === 'undefined') {
    return false;
  }

  const ua = navigator.userAgent || '';
  const isMobileUA = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
  const isTouchMac = /Macintosh/.test(ua) && (navigator as NavigatorWithTouch).maxTouchPoints > 1;

  return isMobileUA || isTouchMac;
};

const downsampleAsciiArt = (art: string, factor: number) => {
  if (factor <= 1) return art;

  const lines = art.split('\n');
  const sampledRows = lines.filter((_, rowIndex) => rowIndex % factor === 0);

  const sampled = sampledRows.map(line => {
    if (!line) return line;
    let reduced = '';
    for (let i = 0; i < line.length; i += factor) {
      reduced += line[i] ?? ' ';
    }
    return reduced;
  });

  return sampled.join('\n');
};

function PhotorealisticProjectPage({
  title,
  bodyText,
  asciiArt,
  artName,
  photo,
  alignment = DEFAULT_PHOTO_TRANSFORM,
  asciiAnchorOffsetY = -13
}: PhotorealisticProjectPageProps) {
  const photoModeEnabled = useMemo(() => {
    if (typeof window === 'undefined') {
      return true;
    }
    return !(IS_SAFARI || isMobileDevice());
  }, []);

  const optimizedAscii = useMemo(() => {
    if (!IS_SAFARI) return asciiArt;
    return downsampleAsciiArt(asciiArt, 2);
  }, [asciiArt]);

  const optimizedText = useMemo(() => {
    if (!IS_SAFARI) return bodyText;
    return bodyText.replace(/\n{3,}/g, '\n\n');
  }, [bodyText]);

  const [textContent, setTextContent] = useState<TextContentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [photoState, setPhotoState] = useState<PhotoState>('ascii');
  const [photoLayout, setPhotoLayout] = useState<PhotorealisticLayout>({
    rawBounds: {},
    paddedBounds: {}
  });
  const [photoOpacity, setPhotoOpacity] = useState(0);
  const [photoOpacityTransition, setPhotoOpacityTransition] = useState<string | undefined>(undefined);
  const [showHighRes, setShowHighRes] = useState(false);
  const [whiteInRequest, setWhiteInRequest] = useState<WhiteInRequest>();
  const photoStateRef = useRef(photoState);
  const enterTimeoutRef = useRef<number | null>(null);
  const exitTimeoutRef = useRef<number | null>(null);
  const photoHistoryPushedRef = useRef(false);
  const exitRequestedRef = useRef(false);

  useEffect(() => {
    photoStateRef.current = photoState;
  }, [photoState]);

  useEffect(() => {
    const textItems: TextContentItem[] = [
      { name: 'title', text: title, x: 0, y: 10, centered: true, fontName: 'ascii' },
      { name: 'back', text: '[[<<<]](#/)', x: 2, y: 4, fixed: true },
      {
        name: 'text',
        text: optimizedText,
        x: 0,
        y: 20,
        centered: true,
        maxWidthPercent: IS_SAFARI ? 55 : 60,
        alignment: 'left',
        anchorTo: 'title',
        anchorPoint: 'bottomCenter',
        anchorOffsetY: 4
      },
      {
        name: artName,
        text: artName,
        x: 0,
        y: 0,
        preRenderedAscii: optimizedAscii,
        centered: true,
        anchorTo: 'text',
        anchorOffsetX: 0,
        anchorOffsetY: asciiAnchorOffsetY,
        anchorPoint: 'bottomCenter'
      }
    ];

    setIsLoading(true);
    const timeout = window.setTimeout(() => {
      setTextContent(textItems);
      setIsLoading(false);
    }, 50);

    return () => window.clearTimeout(timeout);
  }, [artName, asciiAnchorOffsetY, optimizedAscii, optimizedText, title]);

  const handleLayoutChange = useCallback((layout: AsciiLayoutInfo) => {
    setPhotoLayout({
      rawBounds: layout.namedRawBounds,
      paddedBounds: layout.namedBounds
    });
  }, []);

  const photoItems = useMemo<PhotoLayerItem[]>(() => {
    if (!photoModeEnabled) {
      return [];
    }
    return [
      {
        id: `${artName}-main`,
        anchorName: artName,
        lowSrc: photo.src,
        highSrc: photo.src,
        alt: photo.alt,
        boundsSource: 'raw',
        objectFit: 'cover',
        offsetX: alignment.offsetX,
        offsetY: alignment.offsetY,
        scaleX: alignment.scaleX,
        scaleY: alignment.scaleY,
        stretchX: alignment.stretchX ?? 1,
        stretchY: alignment.stretchY ?? 1
      }
    ];
  }, [
    alignment.offsetX,
    alignment.offsetY,
    alignment.scaleX,
    alignment.scaleY,
    alignment.stretchX,
    alignment.stretchY,
    artName,
    photo.alt,
    photo.src,
    photoModeEnabled
  ]);

  const maxPhotoScrollHeight = useMemo(() => {
    if (!photoModeEnabled) {
      return undefined;
    }
    const bounds = photoLayout.rawBounds;
    const boundValues = Object.values(bounds);
    if (!boundValues.length) {
      return undefined;
    }

    let maxY = 0;
    boundValues.forEach(value => {
      if (!value.fixed) {
        maxY = Math.max(maxY, value.maxY);
      }
    });

    return (maxY + 1) * CHAR_HEIGHT;
  }, [photoLayout.rawBounds, photoModeEnabled]);

  const completePhotoEnter = useCallback(() => {
    if (!photoModeEnabled || photoStateRef.current !== 'entering') return;
    if (enterTimeoutRef.current) {
      clearTimeout(enterTimeoutRef.current);
      enterTimeoutRef.current = null;
    }
    photoStateRef.current = 'photo';
    setPhotoState('photo');
    setPhotoOpacityTransition(undefined);
    setPhotoOpacity(1);
  }, [photoModeEnabled]);

  const beginPhotoEnter = useCallback(() => {
    if (!photoModeEnabled || photoStateRef.current !== 'ascii') return;
    if (enterTimeoutRef.current) {
      clearTimeout(enterTimeoutRef.current);
      enterTimeoutRef.current = null;
    }
    photoStateRef.current = 'entering';
    setPhotoState('entering');
    setShowHighRes(true);
    setPhotoOpacityTransition(`opacity ${PHOTO_ENTER_FADE_DURATION}ms linear`);
    setPhotoOpacity(0);
    requestAnimationFrame(() => {
      setPhotoOpacity(1);
    });
    enterTimeoutRef.current = window.setTimeout(() => {
      completePhotoEnter();
    }, PHOTO_ENTER_FADE_DURATION);
  }, [completePhotoEnter, photoModeEnabled]);

  const handleAsciiClickStart = useCallback(() => {
    beginPhotoEnter();
  }, [beginPhotoEnter]);

  const handleAsciiClickComplete = useCallback(() => {
    completePhotoEnter();
  }, [completePhotoEnter]);

  const exitPhotoMode = useCallback((origin: { x: number; y: number }) => {
    if (photoStateRef.current !== 'photo') {
      return;
    }
    photoStateRef.current = 'exiting';
    setPhotoState('exiting');
    if (exitTimeoutRef.current) {
      clearTimeout(exitTimeoutRef.current);
    }

    const normalized = {
      x: window.innerWidth ? (origin.x / window.innerWidth) * 2 - 1 : 0,
      y: window.innerHeight ? (origin.y / window.innerHeight) * 2 - 1 : 0
    };

    const overlay = document.getElementById('white-transition-overlay');
    if (overlay?.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
    setPhotoOpacityTransition(`opacity ${PHOTO_EXIT_FADE_DURATION}ms linear`);
    setPhotoOpacity(0);
    setWhiteInRequest({ position: normalized, token: Date.now(), startProgress: PHOTO_EXIT_WHITEIN_START });
    exitTimeoutRef.current = window.setTimeout(() => {
      setPhotoState('ascii');
      setShowHighRes(false);
      setPhotoOpacityTransition(undefined);
      setPhotoOpacity(0);
    }, PHOTO_EXIT_FADE_DURATION);
    photoHistoryPushedRef.current = false;
    exitRequestedRef.current = false;
  }, []);

  const requestPhotoExit = useCallback((origin: { x: number; y: number }) => {
    const shouldPopHistory = photoHistoryPushedRef.current;
    exitPhotoMode(origin);
    if (shouldPopHistory) {
      exitRequestedRef.current = true;
      window.history.back();
    }
  }, [exitPhotoMode]);

  useEffect(() => {
    if (!photoModeEnabled) {
      if (enterTimeoutRef.current) {
        clearTimeout(enterTimeoutRef.current);
        enterTimeoutRef.current = null;
      }
      if (photoState !== 'ascii') {
        setPhotoState('ascii');
        setShowHighRes(false);
        setPhotoOpacityTransition(undefined);
        setPhotoOpacity(0);
      }
    }
  }, [photoModeEnabled, photoState]);

  useEffect(() => {
    if (photoState === 'photo' && !photoHistoryPushedRef.current) {
      window.history.pushState({ photoMode: true }, '', window.location.href);
      photoHistoryPushedRef.current = true;
    }
  }, [photoState]);

  useEffect(() => {
    const handlePopState = () => {
      if (exitRequestedRef.current) {
        exitRequestedRef.current = false;
        return;
      }

      if (photoState === 'photo') {
        exitPhotoMode({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2
        });
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [exitPhotoMode, photoState]);

  useEffect(() => {
    return () => {
      if (enterTimeoutRef.current) {
        clearTimeout(enterTimeoutRef.current);
      }
      if (exitTimeoutRef.current) {
        clearTimeout(exitTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!photoModeEnabled || photoState !== 'photo') {
      return;
    }

    const handleClick = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      requestPhotoExit({ x: event.clientX, y: event.clientY });
    };

    const handleTouch = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const touch = event.touches[0];
      requestPhotoExit({ x: touch.clientX, y: touch.clientY });
    };

    document.addEventListener('click', handleClick, { capture: true });
    document.addEventListener('touchstart', handleTouch, { capture: true, passive: false });

    return () => {
      document.removeEventListener('click', handleClick, { capture: true });
      document.removeEventListener('touchstart', handleTouch, { capture: true });
    };
  }, [photoModeEnabled, photoState, requestPhotoExit]);

  const showPhotorealisticLayer = photoModeEnabled && photoState !== 'ascii';
  const pauseAsciiAnimation = photoState === 'photo';
  const asciiOverlayOpacity = photoState === 'ascii' || photoState === 'exiting' ? 1 : 0;
  const asciiOverlayTransition = photoModeEnabled
    ? `opacity ${PHOTO_ENTER_FADE_DURATION}ms linear`
    : 'opacity 0.2s ease';

  return (
    <div style={{
      height: '100vh',
      width: '100vw',
      backgroundColor: 'white',
      color: 'white',
      margin: 0,
      padding: 0,
      overflow: 'hidden'
    }}>
      {isLoading ? (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'white',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999
        }}>
        </div>
      ) : (
        <>
          {photoModeEnabled && (
            <PhotorealisticLayer
              items={photoItems}
              layout={photoLayout}
              scrollOffset={scrollOffset}
              isVisible={showPhotorealisticLayer}
              showHighRes={showHighRes}
              isInteractive={false}
              opacity={photoOpacity}
              opacityTransition={photoOpacityTransition}
            />
          )}
          <div style={{
            position: 'relative',
            zIndex: 1,
            opacity: asciiOverlayOpacity,
            transition: asciiOverlayTransition,
            pointerEvents: 'auto',
            willChange: 'opacity'
          }}>
            <AsciiArtGenerator
              textContent={textContent}
              maxScrollHeight={photoState === 'ascii' ? undefined : maxPhotoScrollHeight}
              onScrollOffsetChange={setScrollOffset}
              onLayoutChange={handleLayoutChange}
              onAsciiClickStart={photoModeEnabled && photoState === 'ascii' ? handleAsciiClickStart : undefined}
              onAsciiClickComplete={photoModeEnabled && photoState === 'ascii' ? handleAsciiClickComplete : undefined}
              asciiClickTargets={photoModeEnabled ? [artName] : []}
              pauseAnimation={pauseAsciiAnimation}
              transparentBackground={true}
              disableLinks={photoState !== 'ascii'}
              whiteInRequest={whiteInRequest}
            />
          </div>
        </>
      )}
    </div>
  );
}

export default PhotorealisticProjectPage;
