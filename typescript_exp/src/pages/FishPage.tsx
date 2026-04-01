import ProjectPage from '../components/ProjectPage';
import { getCurrentCharMetrics } from '../components/ascii-art2/constants';
import { getGridDimensions } from '../components/ascii-art2/utils';
import type { PhotorealisticLayout } from '../components/photorealistic/PhotorealisticLayer';
import fishAscii from '../assets/fish/fish_ascii.txt?raw';
import fishText from '../assets/fish/fish_text.txt?raw';
import fishPhoto from '../assets/fish/pictures/fish_placeholder.png';
import { FISH_ALIGN_DEFAULT } from '../assets/fish/align';

const VIMEO_FISH_SRC = 'https://player.vimeo.com/video/1153081771?autoplay=1&muted=1&loop=1&autopause=0&playsinline=1&title=0&byline=0&portrait=0&controls=1';
const FISH_VIDEO_ANCHOR_NAME = 'hero-video-0';
const FISH_VIDEO_WIDTH_SCALE = 0.56;
const FISH_VIDEO_HEIGHT_RATIO = 0.5625;
const FISH_VIDEO_GAP_ROWS = 4;
const FISH_VIDEO_MIN_HEIGHT = 18;
const FISH_VIDEO_MAX_HEIGHT = 36;
const FISH_VIDEO_TOP_PADDING_ROWS = 2;
const FISH_VIDEO_SCROLL_PADDING_ROWS = 3;
const FISH_PHOTO_CONTENT_INSETS = {
  top: 0.133,
  right: 0,
  bottom: 0.005,
  left: 0
};

const augmentFishPhotoLayout = (layout: PhotorealisticLayout): PhotorealisticLayout => {
  const heroBounds = layout.rawBounds.hero;
  if (!heroBounds || typeof window === 'undefined') {
    return layout;
  }

  const { cols } = getGridDimensions(window.innerWidth, window.innerHeight);
  const { charWidth, charHeight } = getCurrentCharMetrics();
  const imageTop = heroBounds.minY + Math.round(FISH_ALIGN_DEFAULT.offsetY);
  const frameWidth = Math.max(1, Math.round(cols * FISH_VIDEO_WIDTH_SCALE));
  const centeredMinX = Math.max(0, Math.round((cols - frameWidth) / 2));
  const targetHeight = Math.round(frameWidth * FISH_VIDEO_HEIGHT_RATIO * (charWidth / charHeight));
  const frameHeight = Math.min(
    FISH_VIDEO_MAX_HEIGHT,
    Math.max(FISH_VIDEO_MIN_HEIGHT, targetHeight)
  );
  const desiredVideoMinY = imageTop - FISH_VIDEO_GAP_ROWS - frameHeight;
  const centeredVideoBounds = {
    minX: centeredMinX,
    maxX: centeredMinX + frameWidth - 1,
    minY: Math.max(FISH_VIDEO_TOP_PADDING_ROWS, desiredVideoMinY),
    maxY: Math.max(FISH_VIDEO_TOP_PADDING_ROWS, desiredVideoMinY) + frameHeight - 1,
    fixed: heroBounds.fixed
  };

  return {
    rawBounds: {
      ...layout.rawBounds,
      [FISH_VIDEO_ANCHOR_NAME]: centeredVideoBounds
    },
    paddedBounds: {
      ...layout.paddedBounds,
      [FISH_VIDEO_ANCHOR_NAME]: centeredVideoBounds
    }
  };
};

function FishPage() {
  return (
    <ProjectPage
      title='This is not a fish'
      text={fishText}
      asciiArt={fishAscii}
      photo={{
        src: fishPhoto,
        alt: 'This is not a fish placeholder',
        contentInsets: FISH_PHOTO_CONTENT_INSETS
      }}
      align={FISH_ALIGN_DEFAULT}
      photoVideos={[
        {
          kind: 'embed',
          embedSrc: VIMEO_FISH_SRC,
          alt: 'This is not a fish video',
          position: 'above',
          widthReference: 'page',
          widthScale: FISH_VIDEO_WIDTH_SCALE,
          heightRatio: FISH_VIDEO_HEIGHT_RATIO,
          maxHeight: FISH_VIDEO_MAX_HEIGHT,
          gap: FISH_VIDEO_GAP_ROWS
        }
      ]}
      photoInitialScrollTargetId={FISH_VIDEO_ANCHOR_NAME}
      photoInitialScrollAlignment='start'
      photoInitialScrollPaddingRows={FISH_VIDEO_SCROLL_PADDING_ROWS}
      photoCenterOnEnter
      photoLayoutAugmenter={augmentFishPhotoLayout}
    />
  );
}

export default FishPage;
