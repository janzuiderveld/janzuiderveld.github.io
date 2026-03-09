import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { TextBounds, TextContentItem } from './ascii-art2/types';
import { IS_SAFARI } from './ascii-art2/constants';
import PhotoModeScene from './photorealistic/PhotoModeScene';
import { PhotoLayerItem } from './photorealistic/PhotorealisticLayer';

type PhotoAlign = {
  offsetX: number;
  offsetY: number;
  scaleX: number;
  scaleY: number;
  stretchX?: number;
  stretchY?: number;
};

type ProjectVideoConfig = {
  kind: 'embed' | 'file';
  embedSrc?: string;
  videoSrc?: string;
  alt: string;
  position?: 'above' | 'below';
  heightRatio?: number;
  widthScale?: number;
  minHeight?: number;
  maxHeight?: number;
  gap?: number;
  offsetRows?: number;
  autoplay?: boolean;
  loop?: boolean;
  muted?: boolean;
  controls?: boolean;
  playsInline?: boolean;
  objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
};

type VideoEntry =
  | (ProjectVideoConfig & {
    kind: 'embed';
    embedSrc: string;
    anchorName: string;
    id: string;
  })
  | (ProjectVideoConfig & {
    kind: 'file';
    videoSrc: string;
    anchorName: string;
    id: string;
  });

type ProjectPageProps = {
  title: string;
  displayTitle?: string;
  text: string;
  asciiArt: string;
  photo:
    | { kind?: 'image'; src: string; alt: string }
    | {
      kind: 'embed';
      embedSrc: string;
      alt: string;
    }
    | {
      kind: 'file';
      videoSrc: string;
      alt: string;
      autoplay?: boolean;
      loop?: boolean;
      muted?: boolean;
      controls?: boolean;
      playsInline?: boolean;
      objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
    };
  align: PhotoAlign;
  photoObjectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
  backHref?: string;
  photoVideos?: ProjectVideoConfig[];
  inlinePhotoLinkLabel?: string;
  showHero?: boolean;
  photoAnchorName?: string;
};

const DEFAULT_VIDEO_HEIGHT_RATIO = 0.35;
const DEFAULT_VIDEO_MIN_HEIGHT = 10;
const DEFAULT_VIDEO_MAX_HEIGHT = 60;
const DEFAULT_VIDEO_GAP = 4;

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

const ProjectPage = ({
  title,
  displayTitle,
  text,
  asciiArt,
  photo,
  align,
  photoObjectFit = 'cover',
  backHref = '#/',
  photoVideos,
  inlinePhotoLinkLabel,
  showHero = true,
  photoAnchorName
}: ProjectPageProps) => {
  const location = useLocation();
  const [textContent, setTextContent] = useState<TextContentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const heroName = 'hero';
  const inlinePhotoLinkName = 'inline-photo-link';
  const videoAnchorName = `${heroName}-video`;
  const renderedTitle = displayTitle ?? title;
  const bodyAnchorName = inlinePhotoLinkLabel ? inlinePhotoLinkName : 'title';
  const resolvedPhotoAnchorName = photoAnchorName ?? (showHero ? heroName : 'text');
  const photoHref = useMemo(() => {
    const path = location.pathname || '/';
    const params = new URLSearchParams(location.search);
    params.set('photo', '1');
    const search = params.toString();
    return `#${path}${search ? `?${search}` : ''}`;
  }, [location.pathname, location.search]);
  const autoEnterPhoto = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const value = (params.get('photo') ?? '').toLowerCase();
    return value === '1' || value === 'true' || value === 'on' || value === 'yes';
  }, [location.search]);

  const optimizedAscii = useMemo(() => {
    if (!IS_SAFARI) return asciiArt;
    return downsampleAsciiArt(asciiArt, 2);
  }, [asciiArt]);

  const optimizedText = useMemo(() => {
    if (!IS_SAFARI) return text;
    return text.replace(/\n{3,}/g, '\n\n');
  }, [text]);

  const videoEntries = useMemo<VideoEntry[]>(() => {
    if (!photoVideos?.length) {
      return [];
    }
    const entries: VideoEntry[] = [];
    photoVideos.forEach((video, index) => {
      const anchorName = `${videoAnchorName}-${index}`;
      const id = `${title}-video-${index}`;
      if (video.kind === 'embed' && video.embedSrc) {
        const entry: VideoEntry = {
          ...video,
          kind: 'embed',
          embedSrc: video.embedSrc,
          anchorName,
          id
        };
        entries.push(entry);
        return;
      }
      if (video.kind === 'file' && video.videoSrc) {
        const entry: VideoEntry = {
          ...video,
          kind: 'file',
          videoSrc: video.videoSrc,
          anchorName,
          id
        };
        entries.push(entry);
      }
    });
    return entries;
  }, [photoVideos, title, videoAnchorName]);

  useEffect(() => {
    setIsLoading(true);
    const textItems: TextContentItem[] = [
      { name: 'title', text: renderedTitle, x: 0, y: 10, centered: true, fontName: 'blockAsciiDouble' },
      { name: 'back', text: `[[<<<]](${backHref})`, x: 2, y: 4, fixed: true },
      {
        name: 'photo-link',
        text: `[[VISUALS]](${photoHref})`,
        x: 70,
        y: 4,
        fixed: true,
        maxWidthPercent: 30,
        alignment: 'right'
      },
      ...(inlinePhotoLinkLabel
        ? [{
          name: inlinePhotoLinkName,
          text: `[[${inlinePhotoLinkLabel}]](${photoHref})`,
          x: 0,
          y: 0,
          centered: true,
          anchorTo: 'title' as const,
          anchorPoint: 'bottomCenter' as const,
          anchorOffsetY: 2,
          alignment: 'center' as const,
          maxWidthPercent: 50
        }]
        : []),
      {
        name: 'text',
        text: optimizedText,
        x: 0,
        y: 20,
        centered: true,
        maxWidthPercent: IS_SAFARI ? 55 : 60,
        alignment: 'left',
        anchorTo: bodyAnchorName,
        anchorPoint: 'bottomCenter',
        anchorOffsetY: inlinePhotoLinkLabel ? 3 : 4
      },
      ...(showHero
        ? [{
          name: heroName,
          text: renderedTitle,
          x: 0,
          y: 0,
          preRenderedAscii: optimizedAscii,
          centered: true,
          anchorTo: 'text' as const,
          anchorPoint: 'bottomCenter' as const,
          anchorOffsetY: -13
        }]
        : [])
    ];

    const timeout = window.setTimeout(() => {
      setTextContent(textItems);
      setIsLoading(false);
    }, 50);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [
    backHref,
    bodyAnchorName,
    heroName,
    inlinePhotoLinkLabel,
    optimizedAscii,
    optimizedText,
    photoHref,
    renderedTitle,
    showHero
  ]);

  const photoItems = useMemo<PhotoLayerItem[]>(() => [
    ...(
      photo.kind === 'embed'
        ? [{
          id: `${title}-main`,
          anchorName: resolvedPhotoAnchorName,
          mediaType: 'video' as const,
          kind: 'embed' as const,
          embedSrc: photo.embedSrc,
          alt: photo.alt,
          boundsSource: 'raw' as const,
          offsetX: align.offsetX,
          offsetY: align.offsetY,
          scaleX: align.scaleX,
          scaleY: align.scaleY,
          stretchX: align.stretchX ?? 1,
          stretchY: align.stretchY ?? 1
        }]
        : photo.kind === 'file'
          ? [{
            id: `${title}-main`,
            anchorName: resolvedPhotoAnchorName,
            mediaType: 'video' as const,
            kind: 'file' as const,
            videoSrc: photo.videoSrc,
            alt: photo.alt,
            boundsSource: 'raw' as const,
            objectFit: photo.objectFit ?? photoObjectFit,
            autoplay: photo.autoplay,
            loop: photo.loop,
            muted: photo.muted,
            controls: photo.controls,
            playsInline: photo.playsInline,
            offsetX: align.offsetX,
            offsetY: align.offsetY,
            scaleX: align.scaleX,
            scaleY: align.scaleY,
            stretchX: align.stretchX ?? 1,
            stretchY: align.stretchY ?? 1
          }]
          : [{
            id: `${title}-main`,
            anchorName: resolvedPhotoAnchorName,
            lowSrc: photo.src,
            highSrc: photo.src,
            alt: photo.alt,
            boundsSource: 'raw' as const,
            objectFit: photoObjectFit,
            offsetX: align.offsetX,
            offsetY: align.offsetY,
            scaleX: align.scaleX,
            scaleY: align.scaleY,
            stretchX: align.stretchX ?? 1,
            stretchY: align.stretchY ?? 1
          }]
    ),
    ...videoEntries.map(entry => (
      entry.kind === 'embed'
        ? {
          id: entry.id,
          anchorName: entry.anchorName,
          mediaType: 'video' as const,
          kind: 'embed' as const,
          embedSrc: entry.embedSrc,
          alt: entry.alt
        }
        : {
          id: entry.id,
          anchorName: entry.anchorName,
          mediaType: 'video' as const,
          kind: 'file' as const,
          videoSrc: entry.videoSrc,
          alt: entry.alt,
          autoplay: entry.autoplay,
          loop: entry.loop,
          muted: entry.muted,
          controls: entry.controls,
          playsInline: entry.playsInline,
          objectFit: entry.objectFit
        }
    ))
  ], [
    align.offsetX,
    align.offsetY,
    align.scaleX,
    align.scaleY,
    align.stretchX,
    align.stretchY,
    photoObjectFit,
    photo,
    resolvedPhotoAnchorName,
    title,
    videoEntries
  ]);

  const layoutAugmenter = useMemo(() => {
    if (videoEntries.length === 0) {
      return undefined;
    }

    return (layout: { rawBounds: Record<string, TextBounds>; paddedBounds: Record<string, TextBounds> }) => {
      const anchorBounds = layout.rawBounds[resolvedPhotoAnchorName];
      if (!anchorBounds) {
        return layout;
      }

      const nextRawBounds = { ...layout.rawBounds };
      const nextPaddedBounds = { ...layout.paddedBounds };
      const aboveEntries = videoEntries.filter(entry => (entry.position ?? 'above') === 'above');
      const belowEntries = videoEntries.filter(entry => (entry.position ?? 'above') === 'below');
      const baseFrameWidth = anchorBounds.maxX - anchorBounds.minX + 1;
      const frameCenterX = Math.round((anchorBounds.minX + anchorBounds.maxX) / 2);
      let aboveEdge = anchorBounds.minY;
      let belowEdge = anchorBounds.maxY;

      const getFrameWidth = (entry: typeof videoEntries[number]) => {
        const widthScale = entry.widthScale ?? 1;
        const safeScale = Number.isFinite(widthScale) && widthScale > 0 ? widthScale : 1;
        return Math.max(1, Math.round(baseFrameWidth * safeScale));
      };

      const applyBounds = (
        entry: typeof videoEntries[number],
        minY: number,
        frameHeight: number,
        frameWidth: number
      ) => {
        const minX = frameCenterX - Math.floor(frameWidth / 2);
        const maxX = minX + frameWidth - 1;
        const bounds: TextBounds = {
          minX,
          maxX,
          minY,
          maxY: minY + frameHeight - 1,
          fixed: anchorBounds.fixed
        };
        nextRawBounds[entry.anchorName] = bounds;
        nextPaddedBounds[entry.anchorName] = bounds;
      };

      aboveEntries.forEach(entry => {
        const heightRatio = entry.heightRatio ?? DEFAULT_VIDEO_HEIGHT_RATIO;
        const minHeight = entry.minHeight ?? DEFAULT_VIDEO_MIN_HEIGHT;
        const maxHeight = entry.maxHeight ?? DEFAULT_VIDEO_MAX_HEIGHT;
        const gap = entry.gap ?? DEFAULT_VIDEO_GAP;
        const offsetRows = entry.offsetRows ?? 0;
        const frameWidth = getFrameWidth(entry);
        const targetHeight = Math.round(frameWidth * heightRatio);
        const frameHeight = Math.min(maxHeight, Math.max(minHeight, targetHeight));
        const minY = aboveEdge - gap - frameHeight + offsetRows;
        applyBounds(entry, minY, frameHeight, frameWidth);
        aboveEdge = minY;
      });

      belowEntries.forEach(entry => {
        const heightRatio = entry.heightRatio ?? DEFAULT_VIDEO_HEIGHT_RATIO;
        const minHeight = entry.minHeight ?? DEFAULT_VIDEO_MIN_HEIGHT;
        const maxHeight = entry.maxHeight ?? DEFAULT_VIDEO_MAX_HEIGHT;
        const gap = entry.gap ?? DEFAULT_VIDEO_GAP;
        const offsetRows = entry.offsetRows ?? 0;
        const frameWidth = getFrameWidth(entry);
        const targetHeight = Math.round(frameWidth * heightRatio);
        const frameHeight = Math.min(maxHeight, Math.max(minHeight, targetHeight));
        const minY = belowEdge + gap + 1 + offsetRows;
        applyBounds(entry, minY, frameHeight, frameWidth);
        belowEdge = minY + frameHeight - 1;
      });

      return {
        rawBounds: nextRawBounds,
        paddedBounds: nextPaddedBounds
      };
    };
  }, [resolvedPhotoAnchorName, videoEntries]);

  return (
    <div
      style={{
        height: '100vh',
        width: '100vw',
        backgroundColor: 'white',
        color: 'white',
        margin: 0,
        padding: 0,
        overflow: 'hidden'
      }}
    >
      {isLoading ? (
        <div
          style={{
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
          }}
        />
      ) : (
        <PhotoModeScene
          textContent={textContent}
          photoItems={photoItems}
          asciiClickTargets={showHero ? [heroName] : []}
          autoEnterPhoto={autoEnterPhoto}
          centerOnLoad={autoEnterPhoto}
          initialScrollTargetId={resolvedPhotoAnchorName}
          layoutAugmenter={layoutAugmenter}
        />
      )}
    </div>
  );
};

export default ProjectPage;
