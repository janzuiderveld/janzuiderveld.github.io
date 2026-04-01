import ProjectPage from '../components/ProjectPage';
import type { PhotorealisticLayout } from '../components/photorealistic/PhotorealisticLayer';
import projectAscii from '../assets/conversations/conversations_ascii.txt?raw';
import projectText from '../assets/conversations/conversations_text.txt?raw';
import projectPhoto from '../assets/conversations/pictures/conversations_placeholder.png';
import projectVideo from '../assets/conversations/pictures/iii_mini_docu_1080p_AdobeExpress_h264.mp4';
import { CONVERSATIONS_ALIGN_DEFAULT } from '../assets/conversations/align';

const CONVERSATIONS_VIDEO_ANCHOR_NAME = 'hero-video-0';
const CONVERSATIONS_PHOTO_ENTRY_ANCHOR_NAME = 'conversations-photo-entry';
const CONVERSATIONS_IMAGE_PREVIEW_ROWS = 32;

const augmentConversationsPhotoLayout = (layout: PhotorealisticLayout): PhotorealisticLayout => {
  const heroBounds = layout.rawBounds.hero;
  const videoBounds = layout.rawBounds[CONVERSATIONS_VIDEO_ANCHOR_NAME];
  if (!heroBounds || !videoBounds) {
    return layout;
  }

  const alignedHeroTop = Math.floor(heroBounds.minY + CONVERSATIONS_ALIGN_DEFAULT.offsetY);
  const entryBounds = {
    minX: Math.min(videoBounds.minX, heroBounds.minX),
    maxX: Math.max(videoBounds.maxX, heroBounds.maxX),
    minY: videoBounds.minY,
    maxY: Math.max(videoBounds.maxY, alignedHeroTop + CONVERSATIONS_IMAGE_PREVIEW_ROWS),
    fixed: heroBounds.fixed
  };

  return {
    rawBounds: {
      ...layout.rawBounds,
      [CONVERSATIONS_PHOTO_ENTRY_ANCHOR_NAME]: entryBounds
    },
    paddedBounds: {
      ...layout.paddedBounds,
      [CONVERSATIONS_PHOTO_ENTRY_ANCHOR_NAME]: entryBounds
    }
  };
};

function ConversationsBeyondTheOrdinaryPage() {
  return (
    <ProjectPage
      title='Conversations Beyond the Ordinary'
      text={projectText}
      asciiArt={projectAscii}
      photo={{ src: projectPhoto, alt: 'Conversations Beyond the Ordinary placeholder' }}
      align={CONVERSATIONS_ALIGN_DEFAULT}
      photoVideos={[
        {
          kind: 'file',
          videoSrc: projectVideo,
          alt: 'Conversations Beyond the Ordinary video',
          position: 'above',
          widthReference: 'page',
          widthScale: 0.5,
          heightRatio: 0.5625,
          gap: 6,
          maxHeight: 36,
          objectFit: 'cover',
          autoplay: true,
          controls: true,
          playsInline: true
        }
      ]}
      photoLayoutAugmenter={augmentConversationsPhotoLayout}
      photoInitialScrollTargetId={CONVERSATIONS_PHOTO_ENTRY_ANCHOR_NAME}
      photoCenterOnEnter
    />
  );
}

export default ConversationsBeyondTheOrdinaryPage;
