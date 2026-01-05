// src/pages/CameraPage.tsx
import { useState, useEffect, useMemo, useCallback, useRef, type CSSProperties } from 'react';
import AsciiArtGenerator from '../components/ascii-art2/AsciiArtGenerator';
import { AsciiLayoutInfo, TextBounds, TextContentItem } from '../components/ascii-art2/types';
import { CHAR_HEIGHT, IS_SAFARI, getCurrentCharMetrics } from '../components/ascii-art2/constants';
import { getGridDimensions } from '../components/ascii-art2/utils';
import PhotorealisticLayer, {
  PhotoLayerItem,
  PhotorealisticLayout
} from '../components/photorealistic/PhotorealisticLayer';
import PhotoHoverWindow, { getPhotoHoverRadiusPx } from '../components/photorealistic/PhotoHoverWindow';
import cameraAsciiArt from '../assets/camera/camera_ascii.txt?raw';
import cameraText from '../assets/camera/camera_text.txt?raw';
import { CAMERA_ALIGN_DEFAULT } from '../assets/camera/align';
import cameraMainPhoto from '../assets/pictures/Camera_void (1).png';

const PHOTO_EXIT_FADE_DURATION = 1000;
const PHOTO_EXIT_WHITEIN_START = 0.45;
const PHOTO_ENTER_FADE_DURATION = PHOTO_EXIT_FADE_DURATION;
const ALIGNMENT_STORAGE_KEY = 'camera-align:camera-main';
const ALIGNMENT_OVERRIDE_KEY = 'camera-align:override';
const ALIGNMENT_PHOTO_OPACITY = 0.5;
const VIMEO_CAMERA_SRC = 'https://player.vimeo.com/video/1070684213?autoplay=1&muted=1&loop=1&autopause=0&playsinline=1&title=0&byline=0&portrait=0&controls=1';
const PHOTO_COLUMN_GAP = 4;
const PHOTO_FRAME_SIDE_MARGIN = 4;
const PHOTO_FRAME_MIN_WIDTH = 32;
const PHOTO_FRAME_MIN_HEIGHT = 10;
const PHOTO_FRAME_MAX_HEIGHT = 60;
const PHOTO_FRAME_HEIGHT_RATIO = 0.35;

type NavigatorWithTouch = Navigator & { maxTouchPoints?: number };

const isMobileDevice = () => {
  if (typeof navigator === 'undefined') {
    return false;
  }

  const ua = navigator.userAgent || '';
  const isMobileUA = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
  const isTouchMac = /Macintosh/.test(ua) && (navigator as NavigatorWithTouch).maxTouchPoints > 1;

  return isMobileUA || isTouchMac;
};

const PHOTO_IMPORTS = import.meta.glob('../assets/pictures/*.{png,jpg,jpeg,webp,gif}', {
  eager: true,
  import: 'default'
}) as Record<string, string>;

const isPlaceholderAsset = (path: string) => path.includes('-placeholder.');

const buildAltFromPath = (path: string) => {
  const fileName = path.split('/').pop() ?? 'Photo';
  const base = fileName.replace(/\.[^.]+$/, '');
  const cleaned = base.replace(/[_-]+/g, ' ').trim();
  return cleaned || 'Photo';
};

const PHOTO_LIBRARY = Object.entries(PHOTO_IMPORTS)
  .filter(([path, src]) => src !== cameraMainPhoto && !isPlaceholderAsset(path))
  .sort(([pathA], [pathB]) => pathA.localeCompare(pathB))
  .map(([path, src], index) => ({
    id: `photo-${index}`,
    src,
    alt: buildAltFromPath(path)
  }));

const PHOTO_COLUMN_IMAGES: PhotoColumnMedia[] = PHOTO_LIBRARY.map(photo => ({
  id: photo.id,
  type: 'image',
  src: photo.src,
  alt: photo.alt
}));

const insertMediaAtPositions = (
  images: PhotoColumnMedia[],
  videos: PhotoColumnVideo[]
): PhotoColumnMedia[] => {
  const next = [...images];
  const sorted = [...videos].sort((a, b) => a.position - b.position);
  sorted.forEach(video => {
    const index = Math.max(0, Math.min(video.position, next.length));
    next.splice(index, 0, {
      id: video.id,
      type: 'video',
      embedSrc: video.embedSrc,
      alt: video.alt
    });
  });
  return next;
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const parseStoredTransform = (raw: string | null): PhotoTransform | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (
      !parsed
      || !isFiniteNumber(parsed.offsetX)
      || !isFiniteNumber(parsed.offsetY)
      || !isFiniteNumber(parsed.scaleX)
      || !isFiniteNumber(parsed.scaleY)
    ) {
      return null;
    }
    return {
      offsetX: parsed.offsetX,
      offsetY: parsed.offsetY,
      scaleX: parsed.scaleX,
      scaleY: parsed.scaleY
    };
  } catch {
    return null;
  }
};

const isVideoItem = (item: PhotoLayerItem): item is Extract<PhotoLayerItem, { mediaType: 'video' }> =>
  item.mediaType === 'video';

const isImageItem = (item: PhotoLayerItem): item is Exclude<PhotoLayerItem, { mediaType: 'video' }> =>
  item.mediaType !== 'video';
type PhotoState = 'ascii' | 'entering' | 'photo' | 'exiting';
type PhotoTransform = {
  offsetX: number;
  offsetY: number;
  scaleX: number;
  scaleY: number;
};
type PhotoColumnMedia =
  | { id: string; type: 'image'; src: string; alt: string }
  | { id: string; type: 'video'; embedSrc: string; alt: string };
type PhotoColumnVideo = {
  id: string;
  embedSrc: string;
  alt: string;
  position: number;
};
type PhotoVideoFrameProps = {
  item: Extract<PhotoLayerItem, { mediaType: 'video' }>;
  style: CSSProperties;
  onForwardWheel: (event: WheelEvent) => void;
};

const DEFAULT_PHOTO_TRANSFORM: PhotoTransform = {
  offsetX: CAMERA_ALIGN_DEFAULT.offsetX,
  offsetY: CAMERA_ALIGN_DEFAULT.offsetY,
  scaleX: CAMERA_ALIGN_DEFAULT.scaleX,
  scaleY: CAMERA_ALIGN_DEFAULT.scaleY
};

const PhotoVideoFrame = ({ item, style, onForwardWheel }: PhotoVideoFrameProps) => {
  const frameRef = useRef<HTMLDivElement | null>(null);

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

  return (
    <div ref={frameRef} data-photo-video="true" style={style}>
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
};

function CameraPage() {
  // console.log("CameraPage component rendering - should only show on /camera route");
  const photoModeEnabled = useMemo(() => {
    if (typeof window === 'undefined') {
      return true;
    }
    return !(IS_SAFARI || isMobileDevice());
  }, []);
  const [textContent, setTextContent] = useState<TextContentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [photoState, setPhotoState] = useState<PhotoState>('ascii');
  const [alignmentMode, setAlignmentMode] = useState(false);
  const [photoTransform, setPhotoTransform] = useState<PhotoTransform>(DEFAULT_PHOTO_TRANSFORM);
  const [photoLayout, setPhotoLayout] = useState<PhotorealisticLayout>({
    rawBounds: {},
    paddedBounds: {}
  });
  const [layoutSize, setLayoutSize] = useState<{ width: number | null; height: number | null }>({ width: null, height: null });
  const [showHighRes, setShowHighRes] = useState(false);
  const [photoOpacity, setPhotoOpacity] = useState(0);
  const [photoOpacityTransition, setPhotoOpacityTransition] = useState<string | undefined>(undefined);
  const [whiteInRequest, setWhiteInRequest] = useState<{ position: { x: number; y: number }; token: number; startProgress?: number }>();
  const [hoveredPhotoItem, setHoveredPhotoItem] = useState<PhotoLayerItem | null>(null);
  const [hoverPreviewActive, setHoverPreviewActive] = useState(false);
  const [saveFlashMessage, setSaveFlashMessage] = useState<string | null>(null);
  const [localOverrideActive, setLocalOverrideActive] = useState(false);
  const exitRequestedRef = useRef(false);
  const photoHistoryPushedRef = useRef(false);
  const photoStateRef = useRef(photoState);
  const alignmentModeRef = useRef(alignmentMode);
  const photoTransformRef = useRef(photoTransform);
  const exitTimeoutRef = useRef<number | null>(null);
  const enterTimeoutRef = useRef<number | null>(null);
  const saveFlashTimeoutRef = useRef<number | null>(null);
  const hoverCursorRef = useRef({ x: 0, y: 0 });
  const hoverTargetRef = useRef<string | null>(null);
  const hoverFrameRef = useRef<number | null>(null);
  const hoverPointerActiveRef = useRef(false);
  const hoverItemsRef = useRef<PhotoLayerItem[]>([]);
  const hoverLayoutRef = useRef(photoLayout);
  const hoverScrollOffsetRef = useRef(scrollOffset);
  const asciiContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    photoStateRef.current = photoState;
  }, [photoState]);

  useEffect(() => {
    alignmentModeRef.current = alignmentMode;
  }, [alignmentMode]);

  useEffect(() => {
    photoTransformRef.current = photoTransform;
  }, [photoTransform]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hasOverride = window.localStorage.getItem(ALIGNMENT_OVERRIDE_KEY) === '1';
    if (!hasOverride) {
      setLocalOverrideActive(false);
      return;
    }
    const stored = parseStoredTransform(window.localStorage.getItem(ALIGNMENT_STORAGE_KEY));
    if (stored) {
      setLocalOverrideActive(true);
      setPhotoTransform(stored);
    } else {
      setLocalOverrideActive(false);
    }
  }, []);

  useEffect(() => {
    if (!alignmentMode) {
      setSaveFlashMessage(null);
      if (saveFlashTimeoutRef.current) {
        clearTimeout(saveFlashTimeoutRef.current);
        saveFlashTimeoutRef.current = null;
      }
    }
  }, [alignmentMode]);

  const downsampleAsciiArt = useCallback((art: string, factor: number) => {
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
  }, []);

  const optimizedAscii = useMemo(() => {
    if (!IS_SAFARI) return cameraAsciiArt;
    return downsampleAsciiArt(cameraAsciiArt, 2);
  }, [downsampleAsciiArt]);

  const optimizedText = useMemo(() => {
    if (!IS_SAFARI) return cameraText;
    return cameraText.replace(/\n{3,}/g, '\n\n');
  }, []);

  const preRenderedArt = useMemo(() => ({
    camera: optimizedAscii,
  }), [optimizedAscii]);

  const photoFrame = useMemo(() => {
    if (!layoutSize.width || !layoutSize.height) {
      return {
        width: PHOTO_FRAME_MIN_WIDTH,
        height: PHOTO_FRAME_MIN_HEIGHT,
        marginCols: PHOTO_FRAME_SIDE_MARGIN,
        cols: null
      };
    }

    const { cols } = getGridDimensions(layoutSize.width, layoutSize.height);
    const aspectRatio = layoutSize.width / Math.max(1, layoutSize.height);
    const isNarrowLayout = aspectRatio < 1;
    const marginPercent = isNarrowLayout ? 0.05 : 0.2;
    const marginCols = Math.max(0, Math.round(cols * marginPercent));
    const frameWidth = Math.max(4, cols - marginCols * 2);
    const frameHeight = Math.min(
      PHOTO_FRAME_MAX_HEIGHT,
      Math.max(PHOTO_FRAME_MIN_HEIGHT, Math.round(frameWidth * PHOTO_FRAME_HEIGHT_RATIO))
    );

    return { width: frameWidth, height: frameHeight, marginCols, cols };
  }, [layoutSize.height, layoutSize.width]);

  const photoColumnMedia = useMemo(() => {
    if (!photoModeEnabled) {
      return [];
    }
    return insertMediaAtPositions(PHOTO_COLUMN_IMAGES, [
      {
        id: 'camera-video',
        embedSrc: VIMEO_CAMERA_SRC,
        alt: 'Life on _ video',
        position: 0
      }
    ]);
  }, [photoModeEnabled]);

  const photoColumnLayout = useMemo(() => {
    const cameraBounds = photoLayout.rawBounds.Camera;
    if (!photoColumnMedia.length || !cameraBounds) {
      return { bounds: {}, items: [] };
    }

    const frameWidth = photoFrame.width;
    const frameHeight = photoFrame.height;
    const step = frameHeight + PHOTO_COLUMN_GAP;
    const left = photoFrame.marginCols;
    const firstImageIndex = photoColumnMedia.findIndex(item => item.type === 'image');
    const cameraInsertIndex = firstImageIndex === -1 ? photoColumnMedia.length : firstImageIndex;
    const bounds: Record<string, TextBounds> = {};
    const items: PhotoLayerItem[] = [];

    photoColumnMedia.forEach((item, index) => {
      const anchorName = `photo-column-${index}`;
      const isAbove = index < cameraInsertIndex;
      const anchorBaseY = isAbove ? cameraBounds.minY : cameraBounds.maxY;
      const anchorOffsetY = isAbove
        ? -(step * (cameraInsertIndex - index))
        : (PHOTO_COLUMN_GAP + 1) + step * (index - cameraInsertIndex);
      const top = anchorBaseY + anchorOffsetY;

      bounds[anchorName] = {
        minX: left,
        maxX: left + frameWidth - 1,
        minY: top,
        maxY: top + frameHeight - 1,
        fixed: false
      };

      if (item.type === 'image') {
        items.push({
          id: item.id,
          anchorName,
          lowSrc: item.src,
          highSrc: item.src,
          alt: item.alt,
          objectFit: 'contain'
        });
      } else {
        items.push({
          id: item.id,
          anchorName,
          mediaType: 'video',
          embedSrc: item.embedSrc,
          alt: item.alt
        });
      }
    });

    return { bounds, items };
  }, [photoColumnMedia, photoFrame.height, photoFrame.marginCols, photoFrame.width, photoLayout.rawBounds.Camera]);

  const photoLayerLayout = useMemo(() => {
    if (!photoModeEnabled || !Object.keys(photoColumnLayout.bounds).length) {
      return photoLayout;
    }

    return {
      rawBounds: {
        ...photoLayout.rawBounds,
        ...photoColumnLayout.bounds
      },
      paddedBounds: {
        ...photoLayout.paddedBounds,
        ...photoColumnLayout.bounds
      }
    };
  }, [photoColumnLayout.bounds, photoLayout, photoModeEnabled]);

  const photoItems = useMemo<PhotoLayerItem[]>(() => {
    if (!photoModeEnabled) {
      return [];
    }
    return [
      {
        id: 'camera-main',
        anchorName: 'Camera',
        lowSrc: cameraMainPhoto,
        highSrc: cameraMainPhoto,
        alt: 'Camera installation',
        boundsSource: 'raw',
        objectFit: 'cover',
        offsetX: photoTransform.offsetX,
        offsetY: photoTransform.offsetY,
        scaleX: photoTransform.scaleX,
        scaleY: photoTransform.scaleY
      },
      ...photoColumnLayout.items
    ];
  }, [
    photoColumnLayout.items,
    photoModeEnabled,
    photoTransform.offsetX,
    photoTransform.offsetY,
    photoTransform.scaleX,
    photoTransform.scaleY
  ]);

  const photoImageItems = useMemo(() => photoItems.filter(isImageItem), [photoItems]);
  const hoverPreviewItems = useMemo(
    () => photoImageItems.filter(item => item.id === 'camera-main'),
    [photoImageItems]
  );
  const photoVideoItems = useMemo(() => photoItems.filter(isVideoItem), [photoItems]);
  const maxPhotoScrollHeight = useMemo(() => {
    if (!photoModeEnabled) {
      return undefined;
    }
    const bounds = photoLayerLayout.rawBounds;
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
  }, [photoLayerLayout.rawBounds, photoModeEnabled]);

  useEffect(() => {
    hoverItemsRef.current = hoverPreviewItems;
  }, [hoverPreviewItems]);

  useEffect(() => {
    hoverLayoutRef.current = photoLayerLayout;
  }, [photoLayerLayout]);

  useEffect(() => {
    hoverScrollOffsetRef.current = scrollOffset;
  }, [scrollOffset]);

  const forwardVideoWheel = useCallback((event: WheelEvent) => {
    const container = asciiContainerRef.current;
    if (!container) {
      return;
    }
    const forwarded = new WheelEvent('wheel', {
      deltaX: event.deltaX,
      deltaY: event.deltaY,
      deltaMode: event.deltaMode,
      bubbles: true,
      cancelable: true
    });
    container.dispatchEvent(forwarded);
  }, []);

  const alignmentPanel = useMemo<TextContentItem | null>(() => {
    if (photoState !== 'ascii' || !alignmentMode) return null;
    const formatValue = (value: number) => value.toFixed(2);
    const saveLabel = saveFlashMessage ?? 'S save local | Shift+S export';
    const overrideLabel = localOverrideActive ? '==LOCAL OVERRIDE==' : '==GLOBAL DEFAULT==';
    const panelText = [
      '==ALIGN MODE==',
      'A toggle | Esc exit',
      saveLabel,
      'Shift+R defaults',
      overrideLabel,
      'Arrows move (shift=fast)',
      '= / - scale (shift=fast)',
      'R reset',
      `dx ${formatValue(photoTransform.offsetX)} dy ${formatValue(photoTransform.offsetY)}`,
      `sc ${formatValue(photoTransform.scaleX)}`
    ].join('\n');

    return {
      name: 'align-panel',
      text: panelText,
      x: 2,
      y: 6,
      fixed: true,
      maxWidthPercent: 40
    };
  }, [alignmentMode, localOverrideActive, photoState, photoTransform.offsetX, photoTransform.offsetY, photoTransform.scaleX, saveFlashMessage]);

  const renderedTextContent = useMemo(() => {
    if (!alignmentPanel) return textContent;
    return [...textContent, alignmentPanel];
  }, [alignmentPanel, textContent]);

  const handleLayoutChange = useCallback((layout: AsciiLayoutInfo) => {
    setPhotoLayout({
      rawBounds: layout.namedRawBounds,
      paddedBounds: layout.namedBounds
    });
    setLayoutSize(layout.size);
  }, []);

  const clearHoverState = useCallback(() => {
    if (hoverFrameRef.current) {
      cancelAnimationFrame(hoverFrameRef.current);
      hoverFrameRef.current = null;
    }
    hoverPointerActiveRef.current = false;
    hoverTargetRef.current = null;
    setHoveredPhotoItem(null);
    setHoverPreviewActive(false);
  }, []);

  const resolveHoverItem = useCallback((clientX: number, clientY: number) => {
    const items = hoverItemsRef.current;
    if (!items.length) return null;

    const layout = hoverLayoutRef.current;
    const { charWidth, charHeight } = getCurrentCharMetrics();
    if (!charWidth || !charHeight) return null;

    const radius = getPhotoHoverRadiusPx();
    const radiusSquared = radius * radius;
    const scrollOffsetPx = hoverScrollOffsetRef.current;

    for (const item of items) {
      const boundsMap = item.boundsSource === 'padded' ? layout.paddedBounds : layout.rawBounds;
      const bounds = boundsMap[item.anchorName];
      if (!bounds) continue;

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
  }, []);

  const updateHoverTarget = useCallback(() => {
    hoverFrameRef.current = null;
    const { x, y } = hoverCursorRef.current;
    const nextItem = resolveHoverItem(x, y);
    const nextId = nextItem?.id ?? null;
    if (nextId === hoverTargetRef.current) {
      return;
    }
    hoverTargetRef.current = nextId;
    setHoveredPhotoItem(nextItem);
    setHoverPreviewActive(Boolean(nextItem));
  }, [resolveHoverItem]);

  const scheduleHoverUpdate = useCallback(() => {
    if (hoverFrameRef.current !== null) {
      return;
    }
    hoverFrameRef.current = requestAnimationFrame(updateHoverTarget);
  }, [updateHoverTarget]);

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

  const enterPhotoMode = useCallback(() => {
    beginPhotoEnter();
  }, [beginPhotoEnter]);

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

  const isPhotoVideoTarget = useCallback((target: EventTarget | null) => {
    if (!(target instanceof Element)) {
      return false;
    }
    return Boolean(target.closest('[data-photo-video="true"]'));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const api = photoModeEnabled
      ? {
        enter: enterPhotoMode,
        exit: () => exitPhotoMode({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
      }
      : {
        enter: () => {},
        exit: () => {}
      };
    (window as typeof window & { __cameraPhotoMode?: typeof api }).__cameraPhotoMode = api;
    return () => {
      delete (window as typeof window & { __cameraPhotoMode?: typeof api }).__cameraPhotoMode;
    };
  }, [enterPhotoMode, exitPhotoMode, photoModeEnabled]);

  useEffect(() => {
    if (photoState !== 'ascii' && alignmentMode) {
      setAlignmentMode(false);
    }
  }, [alignmentMode, photoState]);

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
      if (alignmentMode) {
        setAlignmentMode(false);
      }
      clearHoverState();
    }
  }, [alignmentMode, clearHoverState, photoModeEnabled, photoState]);

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
      if (saveFlashTimeoutRef.current) {
        clearTimeout(saveFlashTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!photoModeEnabled || photoState !== 'photo') {
      return;
    }

    const handleClick = (event: MouseEvent) => {
      if (alignmentModeRef.current) {
        return;
      }
      if (isPhotoVideoTarget(event.target)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      requestPhotoExit({ x: event.clientX, y: event.clientY });
    };

    const handleTouch = (event: TouchEvent) => {
      if (alignmentModeRef.current) {
        return;
      }
      if (isPhotoVideoTarget(event.target)) {
        return;
      }
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
  }, [isPhotoVideoTarget, photoModeEnabled, photoState, requestPhotoExit]);

  useEffect(() => {
    if (!photoModeEnabled || photoState === 'ascii') {
      return;
    }

    const handleWheel = (event: WheelEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      if (!target.closest('[data-photo-video="true"]')) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      forwardVideoWheel(event);
    };

    document.addEventListener('wheel', handleWheel, { capture: true, passive: false });
    return () => {
      document.removeEventListener('wheel', handleWheel, { capture: true });
    };
  }, [forwardVideoWheel, photoModeEnabled, photoState]);

  useEffect(() => {
    if (!photoModeEnabled || photoState !== 'ascii' || alignmentMode) {
      clearHoverState();
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      hoverPointerActiveRef.current = true;
      hoverCursorRef.current = { x: event.clientX, y: event.clientY };
      scheduleHoverUpdate();
    };

    const handleMouseLeave = () => {
      clearHoverState();
    };

    const handleScroll = () => {
      if (!hoverPointerActiveRef.current) return;
      scheduleHoverUpdate();
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('blur', handleMouseLeave);
    document.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('blur', handleMouseLeave);
      document.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('scroll', handleScroll);
    };
  }, [alignmentMode, clearHoverState, photoModeEnabled, photoState, scheduleHoverUpdate]);

  useEffect(() => {
    if (!photoModeEnabled || photoState !== 'ascii' || alignmentMode) {
      return;
    }
    if (!hoverPointerActiveRef.current) {
      return;
    }
    scheduleHoverUpdate();
  }, [alignmentMode, photoModeEnabled, photoState, scheduleHoverUpdate, scrollOffset]);

  useEffect(() => {
    if (!photoModeEnabled) {
      return;
    }

    const clampScale = (value: number) => Math.min(3, Math.max(0.2, value));

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key;
      const isAsciiMode = photoStateRef.current === 'ascii';

      if (key === 'a' || key === 'A') {
        if (!isAsciiMode) {
          return;
        }
        event.preventDefault();
        setAlignmentMode(prev => !prev);
        return;
      }

      if (key === 'Escape') {
        if (alignmentModeRef.current) {
          event.preventDefault();
          setAlignmentMode(false);
        }
        return;
      }

      if (!isAsciiMode || !alignmentModeRef.current) {
        return;
      }

      const isSaveKey = key === 's' || key === 'S';
      if (isSaveKey && event.shiftKey) {
        event.preventDefault();
        const payload = JSON.stringify(photoTransformRef.current, null, 2);
        try {
          if (navigator.clipboard?.writeText) {
            void navigator.clipboard.writeText(payload);
          }
          console.info('Camera align config (paste into src/assets/camera/align.ts):');
          console.info(payload);
          setSaveFlashMessage('==COPIED==');
          if (saveFlashTimeoutRef.current) {
            clearTimeout(saveFlashTimeoutRef.current);
          }
          saveFlashTimeoutRef.current = window.setTimeout(() => {
            setSaveFlashMessage(null);
            saveFlashTimeoutRef.current = null;
          }, 900);
        } catch (error) {
          console.error('Failed to export alignment:', error);
        }
        return;
      }

      const isResetKey = key === 'r' || key === 'R';
      if (isResetKey && event.shiftKey) {
        event.preventDefault();
        try {
          window.localStorage.removeItem(ALIGNMENT_STORAGE_KEY);
          window.localStorage.removeItem(ALIGNMENT_OVERRIDE_KEY);
        } catch (error) {
          console.error('Failed to clear local alignment override:', error);
        }
        setLocalOverrideActive(false);
        setPhotoTransform(DEFAULT_PHOTO_TRANSFORM);
        setSaveFlashMessage('==DEFAULTS==');
        if (saveFlashTimeoutRef.current) {
          clearTimeout(saveFlashTimeoutRef.current);
        }
        saveFlashTimeoutRef.current = window.setTimeout(() => {
          setSaveFlashMessage(null);
          saveFlashTimeoutRef.current = null;
        }, 900);
        return;
      }

      if (isSaveKey) {
        event.preventDefault();
        try {
          window.localStorage.setItem(
            ALIGNMENT_STORAGE_KEY,
            JSON.stringify(photoTransformRef.current)
          );
          window.localStorage.setItem(ALIGNMENT_OVERRIDE_KEY, '1');
          setLocalOverrideActive(true);
          setSaveFlashMessage('==SAVED LOCAL==');
          if (saveFlashTimeoutRef.current) {
            clearTimeout(saveFlashTimeoutRef.current);
          }
          saveFlashTimeoutRef.current = window.setTimeout(() => {
            setSaveFlashMessage(null);
            saveFlashTimeoutRef.current = null;
          }, 900);
        } catch (error) {
          console.error('Failed to save alignment:', error);
        }
        return;
      }

      const moveStep = event.shiftKey ? 2 : 0.5;
      const scaleStep = event.shiftKey ? 0.1 : 0.02;

      switch (key) {
        case 'ArrowUp':
          event.preventDefault();
          setPhotoTransform(prev => ({ ...prev, offsetY: prev.offsetY - moveStep }));
          break;
        case 'ArrowDown':
          event.preventDefault();
          setPhotoTransform(prev => ({ ...prev, offsetY: prev.offsetY + moveStep }));
          break;
        case 'ArrowLeft':
          event.preventDefault();
          setPhotoTransform(prev => ({ ...prev, offsetX: prev.offsetX - moveStep }));
          break;
        case 'ArrowRight':
          event.preventDefault();
          setPhotoTransform(prev => ({ ...prev, offsetX: prev.offsetX + moveStep }));
          break;
        case '=':
        case '+':
          event.preventDefault();
          setPhotoTransform(prev => {
            const nextScale = clampScale(prev.scaleX + scaleStep);
            return { ...prev, scaleX: nextScale, scaleY: nextScale };
          });
          break;
        case '-':
        case '_':
          event.preventDefault();
          setPhotoTransform(prev => {
            const nextScale = clampScale(prev.scaleX - scaleStep);
            return { ...prev, scaleX: nextScale, scaleY: nextScale };
          });
          break;
        case 'r':
        case 'R':
          event.preventDefault();
          setPhotoTransform(DEFAULT_PHOTO_TRANSFORM);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [photoModeEnabled]);

  useEffect(() => {
    const fetchTextContent = async () => {
      setIsLoading(true);
      try {
        const textItems: TextContentItem[] = [
          { name: 'Life on _', text: 'Life on _', x: 0, y: 10, centered: true, fontName: 'ascii' },
          { name: 'back', text: '[[<<<]](#/)', x: 2, y: 4, fixed: true },
          { name: 'text', text: optimizedText, x: 0, y: 20, centered: true, maxWidthPercent: IS_SAFARI ? 55 : 60, alignment: 'left' },
          { name: 'Camera', text: 'Camera', x: 0, y: 0, preRenderedAscii: preRenderedArt.camera, centered: true, anchorTo: 'text', anchorOffsetX: 0, anchorOffsetY: -13, anchorPoint: 'bottomCenter' },
        ];

        setTimeout(() => {
          setTextContent(textItems);
          setIsLoading(false);
        }, 50);
      } catch (error) {
        console.error('Error fetching text content:', error);
        setIsLoading(false);
      }
    };

    fetchTextContent();
  }, [preRenderedArt, optimizedText]);

  const alignmentPhotoActive = photoModeEnabled && photoState === 'ascii' && alignmentMode;
  const showPhotorealisticLayer = photoModeEnabled && (photoState !== 'ascii' || alignmentPhotoActive);
  const pauseAsciiAnimation = photoState === 'photo';
  const asciiOverlayOpacity = photoState === 'ascii' || photoState === 'exiting' ? 1 : 0;
  const asciiOverlayTransition = photoModeEnabled
    ? `opacity ${PHOTO_ENTER_FADE_DURATION}ms linear`
    : 'opacity 0.2s ease';
  const asciiOverlayPointerEvents = 'auto';
  const photoLayerOpacity = alignmentPhotoActive ? ALIGNMENT_PHOTO_OPACITY : photoOpacity;
  const photoLayerTransition = alignmentPhotoActive ? 'opacity 0.2s ease' : photoOpacityTransition;
  const photoLayerHighRes = showHighRes || alignmentPhotoActive;
  const photoLayerItems = alignmentPhotoActive
    ? photoImageItems.filter(item => item.id === 'camera-main')
    : photoImageItems;
  const showPhotoVideos = showPhotorealisticLayer && !alignmentPhotoActive;
  const photoVideoNodes = useMemo(() => {
    if (!showPhotoVideos || photoVideoItems.length === 0) {
      return null;
    }

    const { charWidth, charHeight } = getCurrentCharMetrics();
    if (!charWidth || !charHeight) {
      return null;
    }

    const transition = photoLayerTransition ?? (showPhotoVideos ? 'opacity 0.2s ease' : 'opacity 0s');

    return photoVideoItems.map(item => {
      const boundsMap = item.boundsSource === 'padded' ? photoLayerLayout.paddedBounds : photoLayerLayout.rawBounds;
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
      const isFixed = item.fixed ?? bounds.fixed;
      const transform = isFixed ? 'none' : `translate3d(0, ${-scrollOffset}px, 0)`;

      return (
        <PhotoVideoFrame
          key={item.id}
          item={item}
          onForwardWheel={forwardVideoWheel}
          style={{
            position: 'fixed',
            left,
            top,
            width,
            height,
            transform,
            zIndex: 3,
            opacity: photoLayerOpacity,
            transition,
            pointerEvents: photoLayerOpacity > 0 ? 'auto' : 'none',
            willChange: 'transform, opacity'
          }}
        />
      );
    });
  }, [
    photoLayerLayout.paddedBounds,
    photoLayerLayout.rawBounds,
    photoLayerOpacity,
    photoLayerTransition,
    photoVideoItems,
    scrollOffset,
    showPhotoVideos,
    forwardVideoWheel
  ]);

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
              items={photoLayerItems}
              layout={photoLayerLayout}
              scrollOffset={scrollOffset}
              isVisible={showPhotorealisticLayer}
              showHighRes={photoLayerHighRes}
              isInteractive={false}
              opacity={photoLayerOpacity}
              opacityTransition={photoLayerTransition}
            />
          )}
          {photoModeEnabled && photoVideoNodes}
          {photoModeEnabled && (
            <PhotoHoverWindow
              item={photoState === 'ascii' && !alignmentMode ? hoveredPhotoItem : null}
              layout={photoLayerLayout}
              scrollOffset={scrollOffset}
              cursorRef={hoverCursorRef}
              isActive={photoState === 'ascii' && hoverPreviewActive && !alignmentMode}
            />
          )}
          <div style={{
            position: 'relative',
            zIndex: 1,
            opacity: asciiOverlayOpacity,
            transition: asciiOverlayTransition,
            pointerEvents: asciiOverlayPointerEvents,
            willChange: 'opacity'
          }}>
            <AsciiArtGenerator
              textContent={renderedTextContent}
              maxScrollHeight={photoState === 'ascii' ? undefined : maxPhotoScrollHeight}
              onScrollOffsetChange={setScrollOffset}
              onLayoutChange={handleLayoutChange}
              onAsciiClickStart={photoModeEnabled && photoState === 'ascii' && !alignmentMode ? handleAsciiClickStart : undefined}
              onAsciiClickComplete={photoModeEnabled && photoState === 'ascii' && !alignmentMode ? handleAsciiClickComplete : undefined}
              asciiClickTargets={photoModeEnabled ? ['Camera'] : []}
              pauseAnimation={pauseAsciiAnimation}
              transparentBackground={true}
              disableLinks={photoState !== 'ascii' || alignmentMode}
              whiteInRequest={whiteInRequest}
              externalContainerRef={asciiContainerRef}
            />
          </div>
        </>
      )}
    </div>
  );
}

export default CameraPage;
