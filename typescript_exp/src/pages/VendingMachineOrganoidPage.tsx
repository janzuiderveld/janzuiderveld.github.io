import ProjectPage from '../components/ProjectPage';
import vendingText from '../assets/vending/vending_text.txt?raw';

const VENDING_ALIGN_DEFAULT = {
  offsetX: 0,
  offsetY: 0,
  scaleX: 1,
  scaleY: 1,
  stretchX: 1,
  stretchY: 1
} as const;

const DISPLAY_TITLE = 'Vending Machine\nOrganoid';
const VIMEO_VENDING_SRC = 'https://player.vimeo.com/video/1171787116?app_id=122963';

function VendingMachineOrganoidPage() {
  return (
    <ProjectPage
      title='Vending Machine Organoid'
      displayTitle={DISPLAY_TITLE}
      text={vendingText}
      asciiArt=''
      photo={{
        kind: 'embed',
        embedSrc: VIMEO_VENDING_SRC,
        alt: 'Vending Machine Organoid video'
      }}
      align={VENDING_ALIGN_DEFAULT}
      inlinePhotoLinkLabel='Video & Photos'
      showHero={false}
      photoAnchorName='text'
    />
  );
}

export default VendingMachineOrganoidPage;
