import ProjectPage from '../components/ProjectPage';
import { getGridDimensions } from '../components/ascii-art2/utils';
import { getCurrentCharMetrics } from '../components/ascii-art2/constants';
import type { PhotorealisticLayout } from '../components/photorealistic/PhotorealisticLayer';
import vendingAscii from '../assets/vending/vending_ascii.txt?raw';
import vendingText from '../assets/vending/vending_text.txt?raw';
import vendingMachine from '../assets/vending/pictures/vending-white-max.png';
import vendingInstallation from '../assets/vending/pictures/conflux_installation_Gaiadrr.jpg';
import vendingVisitor from '../assets/vending/pictures/conflux_visitor_Gaiadrr.jpg';
import { VENDING_ALIGN_DEFAULT } from '../assets/vending/align';

const DISPLAY_TITLE = 'Vending Machine\nOrganoid';
const VIMEO_VENDING_SRC = 'https://player.vimeo.com/video/1179367379?badge=0&autopause=0&player_id=0&app_id=58479';
const VENDING_VIDEO_ANCHOR_NAME = 'hero-video-0';
// Match the 56 x 42 ASCII grid to the cabinet, excluding the source's white margins.
const VENDING_CONTENT_INSETS = {
  left: 118 / 2304,
  right: 118 / 2304,
  top: 472 / 3600,
  bottom: 549 / 3600
};

const augmentVendingPhotoLayout = (layout: PhotorealisticLayout): PhotorealisticLayout => {
  if (typeof window === 'undefined' || !layout.rawBounds.hero) return layout;
  const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
  const { cols } = getGridDimensions(viewportWidth, viewportHeight);
  const { charWidth, charHeight } = getCurrentCharMetrics();
  const rawBounds = { ...layout.rawBounds };
  const paddedBounds = { ...layout.paddedBounds };
  const hero = rawBounds.hero;

  // Supplemental frames follow the hero; never resize the shared ASCII/reveal anchor.
  const frame = (name: string, widthScale: number, ratio: number, edge: number, above = false) => {
    const width = Math.max(1, Math.round(cols * widthScale));
    const height = Math.max(1, Math.round(width * ratio * charWidth / charHeight));
    const minX = Math.round((cols - width) / 2);
    const minY = above ? edge - 6 - height : edge + 9;
    const bounds = { minX, maxX: minX + width - 1, minY, maxY: minY + height - 1, fixed: hero.fixed };
    rawBounds[name] = bounds;
    paddedBounds[name] = bounds;
    return bounds;
  };
  if (rawBounds[VENDING_VIDEO_ANCHOR_NAME]) {
    frame(VENDING_VIDEO_ANCHOR_NAME, 0.62, 9 / 16, hero.minY, true);
  }
  let belowEdge = hero.maxY;
  for (const [name, ratio] of [['hero-video-image-0', 2 / 3], ['hero-video-image-1', 1.5]] as const) {
    if (rawBounds[name]) belowEdge = frame(name, 0.76, ratio, belowEdge).maxY;
  }
  return { rawBounds, paddedBounds };
};

function VendingMachineOrganoidPage() {
  return (
    <ProjectPage
      title='Vending Machine Organoid'
      displayTitle={DISPLAY_TITLE}
      text={vendingText}
      asciiArt={vendingAscii.replace(/^\n+|\n+$/g, '')}
      photo={{ src: vendingMachine, alt: "Vending Machine Organoid on a white background — based on a photograph by Gaia D'Arrigo", contentInsets: VENDING_CONTENT_INSETS }}
      align={VENDING_ALIGN_DEFAULT}
      photoAlignmentKey='vending-white-max'
      photoObjectFit='contain'
      photoVideos={[
        {
          kind: 'embed',
          embedSrc: VIMEO_VENDING_SRC,
          alt: 'Vending Machine Organoid video',
          position: 'above',
          widthReference: 'page',
          widthScale: 0.62,
          heightRatio: 0.5625,
          gap: 6,
          maxHeight: 54
        }
      ]}
      photoImages={[
        {
          src: vendingInstallation,
          alt: "Vending Machine Organoid installation at Conflux — photo: Gaia D'Arrigo",
          position: 'below',
          widthReference: 'page',
          widthScale: 0.76,
          heightRatio: 2 / 3,
          gap: 8,
          objectFit: 'contain'
        },
        {
          src: vendingVisitor,
          alt: "Visitor interacting with Vending Machine Organoid at Conflux — photo: Gaia D'Arrigo",
          position: 'below',
          widthReference: 'page',
          widthScale: 0.76,
          heightRatio: 1.5,
          gap: 8,
          maxHeight: 84,
          objectFit: 'contain'
        }
      ]}
      inlinePhotoLinkLabel='Video & Photos'
      heroAnchorOffsetY={-8}
      photoLayoutAugmenter={augmentVendingPhotoLayout}
      photoInitialScrollTargetId={VENDING_VIDEO_ANCHOR_NAME}
      photoInitialScrollAlignment='start'
      photoInitialScrollPaddingRows={5}
      photoCenterOnEnter={true}
    />
  );
}

export default VendingMachineOrganoidPage;
