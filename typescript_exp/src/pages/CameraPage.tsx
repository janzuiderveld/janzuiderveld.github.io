import ProjectPage from '../components/ProjectPage';
import { PhotoLayerItem, PhotorealisticLayout } from '../components/photorealistic/PhotorealisticLayer';
import { getGridDimensions } from '../components/ascii-art2/utils';
import cameraAsciiArt from '../assets/camera/camera_ascii.txt?raw';
import cameraText from '../assets/camera/camera_text.txt?raw';
import { CAMERA_ALIGN_DEFAULT } from '../assets/camera/align';
import cameraMainPhoto from '../assets/pictures/Camera_void (1).png';

const VIMEO_CAMERA_SRC = 'https://player.vimeo.com/video/1070684213?autoplay=1&muted=0&loop=1&autopause=0&playsinline=1&title=0&byline=0&portrait=0&controls=1';
const PHOTO_COLUMN_GAP = 2;
const PHOTO_FRAME_SIDE_MARGIN = 4;
const PHOTO_FRAME_MIN_WIDTH = 32;
const PHOTO_FRAME_MIN_HEIGHT = 10;
const PHOTO_FRAME_MAX_HEIGHT = 60;
const PHOTO_FRAME_HEIGHT_RATIO = 0.22;
const CAMERA_VIDEO_SCROLL_PADDING_ROWS = 2;
const CAMERA_PHOTO_CONTENT_INSETS = {
  top: 0.151,
  right: 0,
  bottom: 0.063,
  left: 0
};

const PHOTO_IMPORTS = import.meta.glob('../assets/pictures/*.{png,jpg,jpeg,webp,gif}', {
  eager: true,
  import: 'default'
}) as Record<string, string>;

type CameraPhotoColumnMedia =
  | { id: string; type: 'image'; src: string; alt: string }
  | { id: string; type: 'video'; embedSrc: string; alt: string };

const isPlaceholderAsset = (path: string) => path.includes('-placeholder.');

const buildAltFromPath = (path: string) => {
  const fileName = path.split('/').pop() ?? 'Photo';
  const base = fileName.replace(/\.[^.]+$/, '');
  const cleaned = base.replace(/[_-]+/g, ' ').trim();
  return cleaned || 'Photo';
};

const insertMediaAtPositions = (
  images: CameraPhotoColumnMedia[],
  videos: Array<{ id: string; embedSrc: string; alt: string; position: number }>
) => {
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

const CAMERA_PHOTO_LIBRARY = Object.entries(PHOTO_IMPORTS)
  .filter(([path, src]) => src !== cameraMainPhoto && !isPlaceholderAsset(path))
  .sort(([pathA], [pathB]) => pathA.localeCompare(pathB))
  .map(([path, src], index) => ({
    id: `photo-${index}`,
    type: 'image' as const,
    src,
    alt: buildAltFromPath(path)
  }));

const CAMERA_COLUMN_MEDIA = insertMediaAtPositions(CAMERA_PHOTO_LIBRARY, [
  {
    id: 'camera-video',
    embedSrc: VIMEO_CAMERA_SRC,
    alt: 'Life on _ video',
    position: 0
  }
]);

const CAMERA_EXTRA_PHOTO_ITEMS: PhotoLayerItem[] = CAMERA_COLUMN_MEDIA.map((item, index) => {
  const anchorName = `photo-column-${index}`;
  if (item.type === 'image') {
    return {
      id: item.id,
      anchorName,
      lowSrc: item.src,
      highSrc: item.src,
      alt: item.alt,
      objectFit: 'contain'
    };
  }

  return {
    id: item.id,
    anchorName,
    mediaType: 'video',
    kind: 'embed',
    embedSrc: item.embedSrc,
    alt: item.alt
  };
});

const resolvePhotoFrame = () => {
  if (typeof window === 'undefined') {
    return {
      width: PHOTO_FRAME_MIN_WIDTH,
      height: PHOTO_FRAME_MIN_HEIGHT,
      marginCols: PHOTO_FRAME_SIDE_MARGIN
    };
  }

  const { cols } = getGridDimensions(window.innerWidth, window.innerHeight);
  const aspectRatio = window.innerWidth / Math.max(1, window.innerHeight);
  const marginPercent = aspectRatio < 1 ? 0.05 : 0.2;
  const marginCols = Math.max(0, Math.round(cols * marginPercent));
  const frameWidth = Math.max(4, cols - marginCols * 2);
  const frameHeight = Math.min(
    PHOTO_FRAME_MAX_HEIGHT,
    Math.max(PHOTO_FRAME_MIN_HEIGHT, Math.round(frameWidth * PHOTO_FRAME_HEIGHT_RATIO))
  );

  return {
    width: frameWidth,
    height: frameHeight,
    marginCols
  };
};

const augmentCameraPhotoLayout = (layout: PhotorealisticLayout): PhotorealisticLayout => {
  const heroBounds = layout.rawBounds.hero;
  if (!heroBounds || CAMERA_COLUMN_MEDIA.length === 0) {
    return layout;
  }

  const photoFrame = resolvePhotoFrame();
  const step = photoFrame.height + PHOTO_COLUMN_GAP;
  const heroImageTop = Math.floor(heroBounds.minY + CAMERA_ALIGN_DEFAULT.offsetY);
  const heroImageHeight = Math.ceil(
    (heroBounds.maxY - heroBounds.minY + 1) * CAMERA_ALIGN_DEFAULT.scaleY
  );
  const heroImageBottom = heroImageTop + heroImageHeight - 1;
  const firstImageIndex = CAMERA_COLUMN_MEDIA.findIndex(item => item.type === 'image');
  const cameraInsertIndex = firstImageIndex === -1 ? CAMERA_COLUMN_MEDIA.length : firstImageIndex;
  const nextColumnBounds = CAMERA_COLUMN_MEDIA.reduce<Record<string, typeof heroBounds>>((bounds, _, index) => {
    const anchorName = `photo-column-${index}`;
    const isAbove = index < cameraInsertIndex;
    const top = isAbove
      ? heroImageTop - PHOTO_COLUMN_GAP - photoFrame.height - step * (cameraInsertIndex - index - 1)
      : heroImageBottom + PHOTO_COLUMN_GAP + 1 + step * (index - cameraInsertIndex);

    bounds[anchorName] = {
      minX: photoFrame.marginCols,
      maxX: photoFrame.marginCols + photoFrame.width - 1,
      minY: top,
      maxY: top + photoFrame.height - 1,
      fixed: false
    };

    return bounds;
  }, {});

  return {
    rawBounds: {
      ...layout.rawBounds,
      ...nextColumnBounds
    },
    paddedBounds: {
      ...layout.paddedBounds,
      ...nextColumnBounds
    }
  };
};

function CameraPage() {
  return (
    <ProjectPage
      title='Life on _'
      titleFontName='ascii'
      text={cameraText}
      asciiArt={cameraAsciiArt}
      photo={{
        src: cameraMainPhoto,
        alt: 'Camera installation',
        contentInsets: CAMERA_PHOTO_CONTENT_INSETS
      }}
      align={CAMERA_ALIGN_DEFAULT}
      extraPhotoItems={CAMERA_EXTRA_PHOTO_ITEMS}
      photoLayoutAugmenter={augmentCameraPhotoLayout}
      photoAlignmentKey='camera-main'
      photoCenterOnEnter={true}
      photoInitialScrollTargetId='photo-column-0'
      photoInitialScrollAlignment='start'
      photoInitialScrollPaddingRows={CAMERA_VIDEO_SCROLL_PADDING_ROWS}
    />
  );
}

export default CameraPage;
