import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import AsciiArtGenerator from '../ascii-art2/AsciiArtGenerator';
import { AsciiLayoutInfo, TextContentItem } from '../ascii-art2/types';
import { CHAR_HEIGHT, IS_SAFARI, getCurrentCharMetrics } from '../ascii-art2/constants';
import PhotorealisticLayer, { PhotoLayerItem, PhotorealisticLayout } from './PhotorealisticLayer';
import PhotoHoverWindow, { getPhotoHoverRadiusPx } from './PhotoHoverWindow';

type PhotoState = 'ascii' | 'entering' | 'photo' | 'exiting';
type PhotoTransform = {
  offsetX: number;
  offsetY: number;
  scaleX: number;
  scaleY: number;
  stretchX: number;
  stretchY: number;
};

type WhiteInRequest = {
  position: { x: number; y: number };
  token: number;
  startProgress?: number;
};

type PhotoVideoItem = Extract<PhotoLayerItem, { mediaType: 'video' }>;

type PhotoVideoFrameProps = {
  item: PhotoVideoItem;
  style: CSSProperties;
  onForwardWheel: (event: WheelEvent) => void;
};

type PhotoModeSceneProps = {
  textContent: TextContentItem[];
  photoItems: PhotoLayerItem[];
  asciiClickTargets: string[];
  maxScrollHeight?: number;
  disablePhotoMode?: boolean;
  autoEnterPhoto?: boolean;
  centerOnLoad?: boolean;
  centerOnEnter?: boolean;
  initialScrollTargetId?: string;
  alignmentKey?: string;
  alignmentTargetId?: string;
  layoutAugmenter?: (layout: PhotorealisticLayout) => PhotorealisticLayout;
};

const PHOTO_EXIT_FADE_DURATION = 1000;
const PHOTO_EXIT_WHITEIN_START = 0.45;
const PHOTO_ENTER_FADE_DURATION = PHOTO_EXIT_FADE_DURATION;
const ALIGNMENT_PHOTO_OPACITY = 0.5;

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

const normalizeAlignmentKey = (value: string) =>
  value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

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
      scaleY: parsed.scaleY,
      stretchX: isFiniteNumber(parsed.stretchX) ? parsed.stretchX : 1,
      stretchY: isFiniteNumber(parsed.stretchY) ? parsed.stretchY : 1
    };
  } catch {
    return null;
  }
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
      <div ref={frameRef} data-photo-video="true" style={style}>
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
    <div ref={frameRef} data-photo-video="true" style={style}>
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
        poster={item.poster}
      />
    </div>
  );
};

const PhotoModeScene = ({
  textContent,
  photoItems,
  asciiClickTargets,
  maxScrollHeight,
  disablePhotoMode = false,
  autoEnterPhoto = false,
  centerOnLoad = false,
  centerOnEnter = false,
  initialScrollTargetId,
  alignmentKey,
  alignmentTargetId,
  layoutAugmenter
}: PhotoModeSceneProps) => {
  const photoModeEnabled = useMemo(() => {
    if (disablePhotoMode) {
      return false;
    }
    if (typeof window === 'undefined') {
      return true;
    }
    return !(IS_SAFARI || isMobileDevice());
  }, [disablePhotoMode]);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [initialScrollOffset, setInitialScrollOffset] = useState<number | undefined>(undefined);
  const [scrollToOffset, setScrollToOffset] = useState<number | null>(null);
  const [initialScrollReady, setInitialScrollReady] = useState(!centerOnLoad);
  const [photoState, setPhotoState] = useState<PhotoState>('ascii');
  const [photoLayout, setPhotoLayout] = useState<PhotorealisticLayout>({
    rawBounds: {},
    paddedBounds: {}
  });
  const [showHighRes, setShowHighRes] = useState(false);
  const [photoOpacity, setPhotoOpacity] = useState(0);
  const [photoOpacityTransition, setPhotoOpacityTransition] = useState<string | undefined>(undefined);
  const [whiteInRequest, setWhiteInRequest] = useState<WhiteInRequest | undefined>(undefined);
  const [alignmentMode, setAlignmentMode] = useState(false);
  const [photoTransform, setPhotoTransform] = useState<PhotoTransform>(() => {
    const targetId = alignmentTargetId ?? photoItems.find(item => item.mediaType !== 'video')?.id ?? photoItems[0]?.id;
    const targetItem = targetId ? photoItems.find(item => item.id === targetId) : undefined;
    const baseItem = targetItem ?? photoItems.find(item => item.mediaType !== 'video') ?? photoItems[0];
    return {
      offsetX: baseItem?.offsetX ?? 0,
      offsetY: baseItem?.offsetY ?? 0,
      scaleX: baseItem?.scaleX ?? 1,
      scaleY: baseItem?.scaleY ?? 1,
      stretchX: baseItem?.stretchX ?? 1,
      stretchY: baseItem?.stretchY ?? 1
    };
  });
  const [localOverrideActive, setLocalOverrideActive] = useState(false);
  const [saveFlashMessage, setSaveFlashMessage] = useState<string | null>(null);
  const [hoveredPhotoItem, setHoveredPhotoItem] = useState<PhotoLayerItem | null>(null);
  const [hoverPreviewActive, setHoverPreviewActive] = useState(false);
  const photoStateRef = useRef(photoState);
  const alignmentModeRef = useRef(alignmentMode);
  const photoTransformRef = useRef(photoTransform);
  const exitTimeoutRef = useRef<number | null>(null);
  const enterTimeoutRef = useRef<number | null>(null);
  const saveFlashTimeoutRef = useRef<number | null>(null);
  const photoHistoryPushedRef = useRef(false);
  const exitRequestedRef = useRef(false);
  const hoverCursorRef = useRef({ x: 0, y: 0 });
  const hoverTargetRef = useRef<string | null>(null);
  const hoverFrameRef = useRef<number | null>(null);
  const hoverPointerActiveRef = useRef(false);
  const hoverItemsRef = useRef<PhotoLayerItem[]>([]);
  const hoverLayoutRef = useRef(photoLayout);
  const hoverScrollOffsetRef = useRef(scrollOffset);
  const initialScrollLockRef = useRef(false);
  const photoParamActiveRef = useRef(false);

  const getPhotoHashParam = useCallback(() => {
    if (typeof window === 'undefined') {
      return null;
    }
    const hash = window.location.hash || '#/';
    const [, query = ''] = hash.split('?');
    const params = new URLSearchParams(query);
    return params.get('photo');
  }, []);

  const hasPhotoHashParam = useCallback(() => {
    const value = (getPhotoHashParam() ?? '').toLowerCase();
    return value === '1' || value === 'true' || value === 'yes' || value === 'on';
  }, [getPhotoHashParam]);

  const stripPhotoHashParam = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const hash = window.location.hash || '#/';
    const [path, query = ''] = hash.split('?');
    const params = new URLSearchParams(query);
    if (!params.has('photo')) {
      return;
    }
    params.delete('photo');
    const nextQuery = params.toString();
    const nextHash = nextQuery ? `${path}?${nextQuery}` : path;
    if (nextHash === window.location.hash) {
      return;
    }
    window.history.replaceState(window.history.state, '', nextHash);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }, []);
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

  const resolvedAlignmentTargetId = useMemo(() => {
    if (alignmentTargetId) {
      return alignmentTargetId;
    }
    const firstImage = photoItems.find(item => item.mediaType !== 'video');
    return firstImage?.id ?? photoItems[0]?.id ?? null;
  }, [alignmentTargetId, photoItems]);

  const alignmentTargetItem = useMemo(() => {
    if (!resolvedAlignmentTargetId) {
      return photoItems[0];
    }
    return photoItems.find(item => item.id === resolvedAlignmentTargetId);
  }, [photoItems, resolvedAlignmentTargetId]);

  const defaultTransform = useMemo<PhotoTransform>(() => {
    const baseItem = alignmentTargetItem ?? photoItems.find(item => item.mediaType !== 'video') ?? photoItems[0];
    return {
      offsetX: baseItem?.offsetX ?? 0,
      offsetY: baseItem?.offsetY ?? 0,
      scaleX: baseItem?.scaleX ?? 1,
      scaleY: baseItem?.scaleY ?? 1,
      stretchX: baseItem?.stretchX ?? 1,
      stretchY: baseItem?.stretchY ?? 1
    };
  }, [alignmentTargetItem, photoItems]);

  const resolvedAlignmentKey = useMemo(() => {
    if (alignmentKey) {
      return normalizeAlignmentKey(alignmentKey);
    }
    if (resolvedAlignmentTargetId) {
      return normalizeAlignmentKey(resolvedAlignmentTargetId);
    }
    if (typeof window !== 'undefined' && window.location.hash) {
      return normalizeAlignmentKey(window.location.hash);
    }
    return null;
  }, [alignmentKey, resolvedAlignmentTargetId]);

  const alignmentStorageKey = useMemo(
    () => (resolvedAlignmentKey ? `photo-align:${resolvedAlignmentKey}` : null),
    [resolvedAlignmentKey]
  );

  useEffect(() => {
    if (!alignmentStorageKey) {
      setPhotoTransform(defaultTransform);
      setLocalOverrideActive(false);
      return;
    }

    const stored = parseStoredTransform(window.localStorage.getItem(alignmentStorageKey));
    if (stored) {
      setLocalOverrideActive(true);
      setPhotoTransform(stored);
    } else {
      setLocalOverrideActive(false);
      setPhotoTransform(defaultTransform);
    }
  }, [alignmentStorageKey, defaultTransform]);

  const alignedPhotoItems = useMemo<PhotoLayerItem[]>(() => {
    if (!resolvedAlignmentTargetId) {
      return photoItems;
    }
    return photoItems.map(item => {
      if (item.id !== resolvedAlignmentTargetId) {
        return item;
      }
      return {
        ...item,
        offsetX: photoTransform.offsetX,
        offsetY: photoTransform.offsetY,
        scaleX: photoTransform.scaleX,
        scaleY: photoTransform.scaleY,
        stretchX: photoTransform.stretchX,
        stretchY: photoTransform.stretchY
      };
    });
  }, [
    photoItems,
    photoTransform.offsetX,
    photoTransform.offsetY,
    photoTransform.scaleX,
    photoTransform.scaleY,
    photoTransform.stretchX,
    photoTransform.stretchY,
    resolvedAlignmentTargetId
  ]);

  const hoverPreviewItems = useMemo(
    () => alignedPhotoItems.filter(item => item.mediaType !== 'video'),
    [alignedPhotoItems]
  );
  const photoImageItems = useMemo(
    () => alignedPhotoItems.filter(item => item.mediaType !== 'video'),
    [alignedPhotoItems]
  );
  const photoVideoItems = useMemo(
    () => alignedPhotoItems.filter(item => item.mediaType === 'video') as PhotoVideoItem[],
    [alignedPhotoItems]
  );

  useEffect(() => {
    hoverItemsRef.current = hoverPreviewItems;
  }, [hoverPreviewItems]);

  const mergedPhotoLayout = useMemo(() => {
    if (!layoutAugmenter) {
      return photoLayout;
    }
    return layoutAugmenter(photoLayout);
  }, [layoutAugmenter, photoLayout]);

  const computeCenteredScrollOffset = useCallback(() => {
    if (!initialScrollTargetId) {
      return null;
    }
    const bounds = mergedPhotoLayout.rawBounds[initialScrollTargetId];
    const { charHeight } = getCurrentCharMetrics();
    if (!bounds || !charHeight || !window.innerHeight) {
      return null;
    }
    const targetCenterRow = (bounds.minY + bounds.maxY) / 2;
    const viewportRows = window.innerHeight / charHeight;
    const desiredScrollRows = Math.max(0, targetCenterRow - viewportRows / 2);
    return desiredScrollRows * charHeight;
  }, [initialScrollTargetId, mergedPhotoLayout.rawBounds]);

  const maybeCenterScroll = useCallback((force: boolean) => {
    if (!initialScrollTargetId) {
      return;
    }
    const bounds = mergedPhotoLayout.rawBounds[initialScrollTargetId];
    const { charHeight } = getCurrentCharMetrics();
    if (!bounds || !charHeight || !window.innerHeight) {
      return;
    }
    const centeredOffset = computeCenteredScrollOffset();
    if (centeredOffset == null) {
      return;
    }
    if (!force) {
      const topPx = bounds.minY * charHeight - scrollOffset;
      const bottomPx = (bounds.maxY + 1) * charHeight - scrollOffset;
      if (topPx >= 0 && bottomPx <= window.innerHeight) {
        return;
      }
    }
    setScrollToOffset(centeredOffset);
  }, [computeCenteredScrollOffset, initialScrollTargetId, mergedPhotoLayout.rawBounds, scrollOffset]);

  useEffect(() => {
    if (!centerOnLoad) {
      setInitialScrollOffset(undefined);
      setInitialScrollReady(true);
      initialScrollLockRef.current = false;
      return;
    }
    if (initialScrollLockRef.current || !initialScrollTargetId) {
      return;
    }
    const nextOffset = computeCenteredScrollOffset();
    if (nextOffset == null) {
      return;
    }
    setInitialScrollOffset(nextOffset);
    setScrollToOffset(nextOffset);
    setInitialScrollReady(true);
    initialScrollLockRef.current = true;
  }, [centerOnLoad, computeCenteredScrollOffset, initialScrollTargetId]);

  const maxPhotoScrollHeight = useMemo(() => {
    const bounds = mergedPhotoLayout.rawBounds;
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
  }, [mergedPhotoLayout.rawBounds]);

  useEffect(() => {
    hoverLayoutRef.current = mergedPhotoLayout;
  }, [mergedPhotoLayout]);

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

  const handleLayoutChange = useCallback((layout: AsciiLayoutInfo) => {
    setPhotoLayout({
      rawBounds: layout.namedRawBounds,
      paddedBounds: layout.namedBounds
    });
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
    if (!photoModeEnabled || photoStateRef.current !== 'entering') {
      return;
    }
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
    if (!photoModeEnabled || photoStateRef.current !== 'ascii') {
      return;
    }
    photoParamActiveRef.current = hasPhotoHashParam();
    if (centerOnEnter) {
      maybeCenterScroll(false);
    }
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
  }, [centerOnEnter, completePhotoEnter, hasPhotoHashParam, maybeCenterScroll, photoModeEnabled]);

  const handleAsciiClickStart = useCallback(() => {
    beginPhotoEnter();
  }, [beginPhotoEnter]);

  const handleAsciiClickComplete = useCallback(() => {
    completePhotoEnter();
  }, [completePhotoEnter]);

  useEffect(() => {
    if (!autoEnterPhoto || !photoModeEnabled || !initialScrollReady) {
      return;
    }
    if (photoStateRef.current !== 'ascii') {
      return;
    }
    const timeout = window.setTimeout(() => {
      beginPhotoEnter();
    }, 80);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [autoEnterPhoto, beginPhotoEnter, initialScrollReady, photoModeEnabled]);

  useEffect(() => {
    if (!photoModeEnabled) {
      return;
    }

    const clampScale = (value: number) => Math.min(3, Math.max(0.2, value));

    const setFlashMessage = (message: string) => {
      setSaveFlashMessage(message);
      if (saveFlashTimeoutRef.current) {
        clearTimeout(saveFlashTimeoutRef.current);
      }
      saveFlashTimeoutRef.current = window.setTimeout(() => {
        setSaveFlashMessage(null);
        saveFlashTimeoutRef.current = null;
      }, 900);
    };

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
          console.info('Photo align config:');
          console.info(payload);
          setFlashMessage('==COPIED==');
        } catch (error) {
          console.error('Failed to copy alignment:', error);
          setFlashMessage('==COPY FAILED==');
        }
        return;
      }

      if (isSaveKey) {
        event.preventDefault();
        if (!alignmentStorageKey) {
          setFlashMessage('==NO LOCAL KEY==');
          return;
        }
        try {
          window.localStorage.setItem(
            alignmentStorageKey,
            JSON.stringify(photoTransformRef.current)
          );
          setLocalOverrideActive(true);
          setFlashMessage('==SAVED LOCAL==');
        } catch (error) {
          console.error('Failed to save alignment:', error);
          setFlashMessage('==SAVE FAILED==');
        }
        return;
      }

      const moveStep = event.shiftKey ? 2 : 0.5;
      const scaleStep = event.shiftKey ? 0.1 : 0.02;
      const adjustStretch = (axis: 'x' | 'y', delta: number) => {
        setPhotoTransform(prev => {
          const current = axis === 'x' ? prev.stretchX : prev.stretchY;
          const nextScale = clampScale(current + delta);
          return axis === 'x'
            ? { ...prev, stretchX: nextScale }
            : { ...prev, stretchY: nextScale };
        });
      };

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
            const nextScaleX = clampScale(prev.scaleX + scaleStep);
            const nextScaleY = clampScale(prev.scaleY + scaleStep);
            return { ...prev, scaleX: nextScaleX, scaleY: nextScaleY };
          });
          break;
        case '-':
        case '_':
          event.preventDefault();
          setPhotoTransform(prev => {
            const nextScaleX = clampScale(prev.scaleX - scaleStep);
            const nextScaleY = clampScale(prev.scaleY - scaleStep);
            return { ...prev, scaleX: nextScaleX, scaleY: nextScaleY };
          });
          break;
        case '[':
        case '{':
          event.preventDefault();
          adjustStretch('x', -scaleStep);
          break;
        case ']':
        case '}':
          event.preventDefault();
          adjustStretch('x', scaleStep);
          break;
        case ',':
        case '<':
          event.preventDefault();
          adjustStretch('y', -scaleStep);
          break;
        case '.':
        case '>':
          event.preventDefault();
          adjustStretch('y', scaleStep);
          break;
        case 'r':
        case 'R':
          event.preventDefault();
          setPhotoTransform(defaultTransform);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [alignmentStorageKey, defaultTransform, photoModeEnabled]);

  useEffect(() => {
    if (!alignmentMode) {
      setSaveFlashMessage(null);
      if (saveFlashTimeoutRef.current) {
        clearTimeout(saveFlashTimeoutRef.current);
        saveFlashTimeoutRef.current = null;
      }
    }
  }, [alignmentMode]);

  useEffect(() => {
    if (photoState !== 'ascii' && alignmentMode) {
      setAlignmentMode(false);
    }
  }, [alignmentMode, photoState]);

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
    setWhiteInRequest({
      position: normalized,
      token: Date.now(),
      startProgress: PHOTO_EXIT_WHITEIN_START
    });
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
    if (photoParamActiveRef.current) {
      photoParamActiveRef.current = false;
      stripPhotoHashParam();
      return;
    }
    if (shouldPopHistory) {
      exitRequestedRef.current = true;
      window.history.back();
    }
  }, [exitPhotoMode, stripPhotoHashParam]);

  useEffect(() => {
    if (!photoModeEnabled || photoState !== 'photo') {
      return;
    }

    const isPhotoVideoTarget = (target: EventTarget | null) =>
      target instanceof HTMLElement && Boolean(target.closest('[data-photo-video="true"]'));

    const handleClick = (event: MouseEvent) => {
      if (isPhotoVideoTarget(event.target)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      requestPhotoExit({ x: event.clientX, y: event.clientY });
    };

    const handleTouch = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        return;
      }
      if (isPhotoVideoTarget(event.target)) {
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
    if (photoState === 'photo' && !photoHistoryPushedRef.current) {
      if (!photoParamActiveRef.current) {
        window.history.pushState({ photoMode: true }, '', window.location.href);
        photoHistoryPushedRef.current = true;
      }
    }
  }, [photoState]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const api = {
      enter: beginPhotoEnter,
      exit: () => exitPhotoMode({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
    };
    (window as typeof window & { __projectPhotoMode?: typeof api }).__projectPhotoMode = api;
    return () => {
      delete (window as typeof window & { __projectPhotoMode?: typeof api }).__projectPhotoMode;
    };
  }, [beginPhotoEnter, exitPhotoMode]);

  useEffect(() => {
    const handlePopState = () => {
      if (exitRequestedRef.current) {
        exitRequestedRef.current = false;
        return;
      }

      if (photoStateRef.current === 'photo') {
        exitPhotoMode({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2
        });
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [exitPhotoMode]);

  useEffect(() => {
    if (!photoModeEnabled) {
      if (enterTimeoutRef.current) {
        clearTimeout(enterTimeoutRef.current);
        enterTimeoutRef.current = null;
      }
      if (exitTimeoutRef.current) {
        clearTimeout(exitTimeoutRef.current);
        exitTimeoutRef.current = null;
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
    }
  }, [alignmentMode, photoModeEnabled, photoState]);

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

  const alignmentPhotoActive = photoModeEnabled && photoState === 'ascii' && alignmentMode;
  const showPhotorealisticLayer = photoModeEnabled && (photoState !== 'ascii' || alignmentPhotoActive);
  const asciiOverlayOpacity = photoState === 'ascii' || photoState === 'exiting' ? 1 : 0;
  const asciiOverlayTransition = photoModeEnabled
    ? `opacity ${PHOTO_ENTER_FADE_DURATION}ms linear`
    : 'opacity 0.2s ease';
  const effectiveMaxScrollHeight = maxScrollHeight ?? maxPhotoScrollHeight;
  const photoLayerOpacity = alignmentPhotoActive ? ALIGNMENT_PHOTO_OPACITY : (photoModeEnabled ? photoOpacity : 0);
  const photoLayerTransition = alignmentPhotoActive ? 'opacity 0.2s ease' : photoOpacityTransition;
  const photoLayerHighRes = showHighRes || alignmentPhotoActive;
  const photoLayerItems = photoModeEnabled ? photoImageItems : [];
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
      const boundsMap = item.boundsSource === 'padded' ? mergedPhotoLayout.paddedBounds : mergedPhotoLayout.rawBounds;
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
    forwardVideoWheel,
    mergedPhotoLayout.paddedBounds,
    mergedPhotoLayout.rawBounds,
    photoLayerOpacity,
    photoLayerTransition,
    photoVideoItems,
    scrollOffset,
    showPhotoVideos
  ]);

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
      '= / - scale all (shift=fast)',
      '[ / ] stretch X (shift=fast)',
      ', / . stretch Y (shift=fast)',
      'R reset',
      `dx ${formatValue(photoTransform.offsetX)} dy ${formatValue(photoTransform.offsetY)}`,
      `scx ${formatValue(photoTransform.scaleX)} scy ${formatValue(photoTransform.scaleY)}`,
      `stx ${formatValue(photoTransform.stretchX)} sty ${formatValue(photoTransform.stretchY)}`
    ].join('\n');

    return {
      name: 'align-panel',
      text: panelText,
      x: 2,
      y: 6,
      fixed: true,
      maxWidthPercent: 40
    };
  }, [
    alignmentMode,
    localOverrideActive,
    photoState,
    photoTransform.offsetX,
    photoTransform.offsetY,
    photoTransform.scaleX,
    photoTransform.scaleY,
    photoTransform.stretchX,
    photoTransform.stretchY,
    saveFlashMessage
  ]);

  const renderedTextContent = useMemo(() => {
    if (!alignmentPanel) return textContent;
    return [...textContent, alignmentPanel];
  }, [alignmentPanel, textContent]);

  return (
    <>
      {photoModeEnabled && photoLayerItems.length > 0 && (
        <PhotorealisticLayer
          items={photoLayerItems}
          layout={mergedPhotoLayout}
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
          layout={mergedPhotoLayout}
          scrollOffset={scrollOffset}
          cursorRef={hoverCursorRef}
          isActive={photoState === 'ascii' && hoverPreviewActive && !alignmentMode}
        />
      )}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          opacity: asciiOverlayOpacity,
          transition: asciiOverlayTransition,
          pointerEvents: 'auto',
          willChange: 'opacity'
        }}
      >
        <AsciiArtGenerator
          textContent={renderedTextContent}
          maxScrollHeight={effectiveMaxScrollHeight}
          initialScrollOffset={initialScrollOffset}
          scrollToOffset={scrollToOffset}
          onScrollOffsetChange={setScrollOffset}
          onLayoutChange={handleLayoutChange}
          onAsciiClickStart={photoModeEnabled && photoState === 'ascii' && !alignmentMode ? handleAsciiClickStart : undefined}
          onAsciiClickComplete={photoModeEnabled && photoState === 'ascii' && !alignmentMode ? handleAsciiClickComplete : undefined}
          asciiClickTargets={photoModeEnabled && !alignmentMode ? asciiClickTargets : []}
          pauseAnimation={photoState === 'photo'}
          transparentBackground={true}
          disableLinks={photoState !== 'ascii' || alignmentMode}
          whiteInRequest={whiteInRequest}
          externalContainerRef={asciiContainerRef}
        />
      </div>
    </>
  );
};

export default PhotoModeScene;
