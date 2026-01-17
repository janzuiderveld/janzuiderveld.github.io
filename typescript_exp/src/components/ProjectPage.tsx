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
  text: string;
  asciiArt: string;
  photo: { src: string; alt: string };
  align: PhotoAlign;
  backHref?: string;
  photoVideos?: ProjectVideoConfig[];
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
  text,
  asciiArt,
  photo,
  align,
  backHref = '#/',
  photoVideos
}: ProjectPageProps) => {
  const location = useLocation();
  const [textContent, setTextContent] = useState<TextContentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const heroName = 'hero';
  const videoAnchorName = `${heroName}-video`;
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
      { name: 'title', text: title, x: 0, y: 10, centered: true, fontName: 'blockAsciiDouble' },
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
        name: heroName,
        text: title,
        x: 0,
        y: 0,
        preRenderedAscii: optimizedAscii,
        centered: true,
        anchorTo: 'text',
        anchorPoint: 'bottomCenter',
        anchorOffsetY: -13
      }
    ];

    const timeout = window.setTimeout(() => {
      setTextContent(textItems);
      setIsLoading(false);
    }, 50);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [backHref, heroName, optimizedAscii, optimizedText, photoHref, title]);

  const photoItems = useMemo<PhotoLayerItem[]>(() => [
    {
      id: `${title}-main`,
      anchorName: heroName,
      lowSrc: photo.src,
      highSrc: photo.src,
      alt: photo.alt,
      boundsSource: 'raw',
      objectFit: 'cover',
      offsetX: align.offsetX,
      offsetY: align.offsetY,
      scaleX: align.scaleX,
      scaleY: align.scaleY,
      stretchX: align.stretchX ?? 1,
      stretchY: align.stretchY ?? 1
    },
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
    heroName,
    photo.alt,
    photo.src,
    title,
    videoEntries
  ]);

  const layoutAugmenter = useMemo(() => {
    if (videoEntries.length === 0) {
      return undefined;
    }

    return (layout: { rawBounds: Record<string, TextBounds>; paddedBounds: Record<string, TextBounds> }) => {
      const heroBounds = layout.rawBounds[heroName];
      if (!heroBounds) {
        return layout;
      }

      const nextRawBounds = { ...layout.rawBounds };
      const nextPaddedBounds = { ...layout.paddedBounds };
      const aboveEntries = videoEntries.filter(entry => (entry.position ?? 'above') === 'above');
      const belowEntries = videoEntries.filter(entry => (entry.position ?? 'above') === 'below');
      const baseFrameWidth = heroBounds.maxX - heroBounds.minX + 1;
      const frameCenterX = Math.round((heroBounds.minX + heroBounds.maxX) / 2);
      let aboveEdge = heroBounds.minY;
      let belowEdge = heroBounds.maxY;

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
          fixed: heroBounds.fixed
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
  }, [heroName, videoEntries]);

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
          asciiClickTargets={[heroName]}
          autoEnterPhoto={autoEnterPhoto}
          centerOnLoad={autoEnterPhoto}
          initialScrollTargetId={heroName}
          layoutAugmenter={layoutAugmenter}
        />
      )}
    </div>
  );
};

export default ProjectPage;
