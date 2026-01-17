import ProjectPage from '../components/ProjectPage';
import projectAscii from '../assets/coffee/coffee_ascii.txt?raw';
import projectText from '../assets/coffee/coffee_text.txt?raw';
import projectPhoto from '../assets/coffee/pictures/coffee_placeholder.png';
import nieuweInstituutVideo from '../assets/coffee/pictures/Het Nieuwe Instituut (1).mov';
import { COFFEE_ALIGN_DEFAULT } from '../assets/coffee/align';

const VIMEO_COFFEE_SRC = 'https://player.vimeo.com/video/897392617?autoplay=1&muted=1&loop=1&autopause=0&playsinline=1&title=0&byline=0&portrait=0&controls=1';

function CoffeeMachinePage() {
  return (
    <ProjectPage
      title='Coffee Machine'
      text={projectText}
      asciiArt={projectAscii}
      photo={{ src: projectPhoto, alt: 'Coffee Machine placeholder' }}
      align={COFFEE_ALIGN_DEFAULT}
      photoVideos={[
        {
          kind: 'embed',
          embedSrc: VIMEO_COFFEE_SRC,
          alt: 'Coffee Machine video',
          position: 'above',
          widthScale: 2.5,
          gap: 15
        },
        {
          kind: 'file',
          videoSrc: nieuweInstituutVideo,
          alt: 'Het Nieuwe Instituut video',
          position: 'below',
          gap: 15,
          heightRatio: 1.06,
          widthScale: 1.5,
          maxHeight: 160,
          objectFit: 'contain',
          controls: true,
          playsInline: true
        }
      ]}
    />
  );
}

export default CoffeeMachinePage;
