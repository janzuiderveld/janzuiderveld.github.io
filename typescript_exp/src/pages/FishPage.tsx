import ProjectPage from '../components/ProjectPage';
import fishAscii from '../assets/fish/fish_ascii.txt?raw';
import fishText from '../assets/fish/fish_text.txt?raw';
import fishPhoto from '../assets/fish/pictures/fish_placeholder.png';
import { FISH_ALIGN_DEFAULT } from '../assets/fish/align';

function FishPage() {
  return (
    <ProjectPage
      title='This is not a fish'
      text={fishText}
      asciiArt={fishAscii}
      photo={{ src: fishPhoto, alt: 'This is not a fish placeholder' }}
      align={FISH_ALIGN_DEFAULT}
    />
  );
}

export default FishPage;
