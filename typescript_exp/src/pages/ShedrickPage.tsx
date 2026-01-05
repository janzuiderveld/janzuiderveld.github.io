import ProjectPage from '../components/ProjectPage';
import projectAscii from '../assets/shedrick/shedrick_ascii.txt?raw';
import projectText from '../assets/shedrick/shedrick_text.txt?raw';
import projectPhoto from '../assets/shedrick/pictures/shedrick_placeholder.png';
import { SHEDRICK_ALIGN_DEFAULT } from '../assets/shedrick/align';

function ShedrickPage() {
  return (
    <ProjectPage
      title='Shedrick'
      text={projectText}
      asciiArt={projectAscii}
      photo={{ src: projectPhoto, alt: 'Shedrick placeholder' }}
      align={SHEDRICK_ALIGN_DEFAULT}
    />
  );
}

export default ShedrickPage;
