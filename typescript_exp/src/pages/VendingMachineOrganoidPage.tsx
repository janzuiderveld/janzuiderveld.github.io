import ProjectPage from '../components/ProjectPage';
import vendingAscii from '../assets/vending/vending_ascii.txt?raw';
import vendingText from '../assets/vending/vending_text.txt?raw';
import vendingMachinePhoto from '../assets/vending/pictures/vending_machine.png';
import vendingInstallation from '../assets/vending/pictures/vending_installation.jpg';
import { VENDING_ALIGN_DEFAULT } from '../assets/vending/align';

const DISPLAY_TITLE = 'Vending Machine\nOrganoid';
const VIMEO_VENDING_SRC = 'https://player.vimeo.com/video/1179367379?badge=0&autopause=0&player_id=0&app_id=58479';

function VendingMachineOrganoidPage() {
  return (
    <ProjectPage
      title='Vending Machine Organoid'
      displayTitle={DISPLAY_TITLE}
      text={vendingText}
      asciiArt={vendingAscii.replace(/^\n+|\n+$/g, '')}
      photo={{ src: vendingMachinePhoto, alt: 'Vending Machine Organoid vending machine' }}
      align={VENDING_ALIGN_DEFAULT}
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
          alt: 'Vending Machine Organoid installation view',
          position: 'below',
          widthReference: 'page',
          widthScale: 0.76,
          heightRatio: 0.75,
          gap: 8,
          maxHeight: 84,
          objectFit: 'contain'
        }
      ]}
      inlinePhotoLinkLabel='Video & Photos'
      heroAnchorOffsetY={-8}
      photoInitialScrollTargetId='hero-video-0'
      photoInitialScrollAlignment='start'
      photoInitialScrollPaddingRows={5}
      photoCenterOnEnter={true}
    />
  );
}

export default VendingMachineOrganoidPage;
