import ProjectPage from '../components/ProjectPage';
import vendingAscii from '../assets/vending/vending_ascii.txt?raw';
import vendingText from '../assets/vending/vending_text.txt?raw';
import vendingPlaceholder from '../assets/vending/pictures/vending_placeholder.jpg';
import vendingInstallation from '../assets/vending/pictures/vending_installation.jpg';
import { VENDING_ALIGN_DEFAULT } from '../assets/vending/align';

const DISPLAY_TITLE = 'Vending Machine\nOrganoid';
const VIMEO_VENDING_SRC = 'https://player.vimeo.com/video/1171787116?app_id=122963';

function VendingMachineOrganoidPage() {
  return (
    <ProjectPage
      title='Vending Machine Organoid'
      displayTitle={DISPLAY_TITLE}
      text={vendingText}
      asciiArt={vendingAscii}
      photo={{ src: vendingPlaceholder, alt: 'Vending Machine Organoid placeholder', filter: 'brightness(0)' }}
      align={VENDING_ALIGN_DEFAULT}
      photoObjectFit='contain'
      photoVideos={[
        {
          kind: 'embed',
          embedSrc: VIMEO_VENDING_SRC,
          alt: 'Vending Machine Organoid video',
          position: 'above',
          widthReference: 'page',
          widthScale: 0.8,
          heightRatio: 0.5625,
          gap: 10,
          maxHeight: 90
        }
      ]}
      photoImages={[
        {
          src: vendingInstallation,
          alt: 'Vending Machine Organoid installation view',
          position: 'below',
          widthReference: 'page',
          widthScale: 0.8,
          heightRatio: 0.75,
          gap: 10,
          maxHeight: 90,
          objectFit: 'contain'
        }
      ]}
      inlinePhotoLinkLabel='Video & Photos'
      heroAnchorOffsetY={-8}
    />
  );
}

export default VendingMachineOrganoidPage;
