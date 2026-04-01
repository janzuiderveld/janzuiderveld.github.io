import ProjectPage from '../components/ProjectPage';
import { PhotorealisticLayout } from '../components/photorealistic/PhotorealisticLayer';
import projectAscii from '../assets/microwave/microwave_ascii.txt?raw';
import projectText from '../assets/microwave/microwave_text.txt?raw';
import projectPhoto from '../assets/microwave/pictures/microwave_placeholder.png';
import projectVideo from '../assets/microwave/pictures/microwave_sample.mp4';
import { MICROWAVE_ALIGN_DEFAULT } from '../assets/microwave/align';

const MICROWAVE_VIDEO_ANCHOR_NAME = 'hero-video-0';
const MICROWAVE_VIDEO_TOP_MARGIN = 6;
const MICROWAVE_VIDEO_STACK_GAP = 6;
const MICROWAVE_VIDEO_TARGET_HEIGHT = 36;
const MICROWAVE_VIDEO_HEIGHT_STEP = 3;
const MICROWAVE_VIDEO_WIDTH_STEP = 4;

const floorToMultiple = (value: number, step: number) => Math.floor(value / step) * step;

const augmentMicrowavePhotoLayout = (layout: PhotorealisticLayout): PhotorealisticLayout => {
  const heroBounds = layout.rawBounds.hero;
  const videoBounds = layout.rawBounds[MICROWAVE_VIDEO_ANCHOR_NAME];
  if (!heroBounds || !videoBounds) {
    return layout;
  }

  const alignedHeroTop = Math.floor(heroBounds.minY + MICROWAVE_ALIGN_DEFAULT.offsetY);
  const availableWidth = videoBounds.maxX - videoBounds.minX + 1;
  const availableHeight = alignedHeroTop - MICROWAVE_VIDEO_TOP_MARGIN - MICROWAVE_VIDEO_STACK_GAP;
  const maxHeightFromWidth = floorToMultiple(Math.floor((availableWidth * 3) / 4), MICROWAVE_VIDEO_HEIGHT_STEP);
  const frameHeight = Math.max(
    MICROWAVE_VIDEO_HEIGHT_STEP,
    floorToMultiple(
      Math.min(MICROWAVE_VIDEO_TARGET_HEIGHT, availableHeight, maxHeightFromWidth),
      MICROWAVE_VIDEO_HEIGHT_STEP
    )
  );
  const frameWidth = (frameHeight / MICROWAVE_VIDEO_HEIGHT_STEP) * MICROWAVE_VIDEO_WIDTH_STEP;
  const centerX = Math.round((videoBounds.minX + videoBounds.maxX) / 2);
  const minX = centerX - Math.floor(frameWidth / 2);
  const minY = Math.max(MICROWAVE_VIDEO_TOP_MARGIN, alignedHeroTop - MICROWAVE_VIDEO_STACK_GAP - frameHeight);
  const adjustedBounds = {
    minX,
    maxX: minX + frameWidth - 1,
    minY,
    maxY: minY + frameHeight - 1,
    fixed: videoBounds.fixed
  };

  return {
    rawBounds: {
      ...layout.rawBounds,
      [MICROWAVE_VIDEO_ANCHOR_NAME]: adjustedBounds
    },
    paddedBounds: {
      ...layout.paddedBounds,
      [MICROWAVE_VIDEO_ANCHOR_NAME]: adjustedBounds
    }
  };
};

function MicrowavePage() {
  return (
    <ProjectPage
      title='Microwave'
      text={projectText}
      asciiArt={projectAscii}
      photo={{ src: projectPhoto, alt: 'Microwave placeholder' }}
      align={MICROWAVE_ALIGN_DEFAULT}
      photoVideos={[
        {
          kind: 'file',
          videoSrc: projectVideo,
          alt: 'Microwave video',
          position: 'above',
          widthReference: 'page',
          widthScale: 0.5,
          heightRatio: 1.25,
          gap: MICROWAVE_VIDEO_STACK_GAP,
          maxHeight: MICROWAVE_VIDEO_TARGET_HEIGHT,
          objectFit: 'contain',
          autoplay: true,
          controls: true,
          playsInline: true
        }
      ]}
      photoLayoutAugmenter={augmentMicrowavePhotoLayout}
      photoInitialScrollTargetId={MICROWAVE_VIDEO_ANCHOR_NAME}
      photoCenterOnEnter
    />
  );
}

export default MicrowavePage;
