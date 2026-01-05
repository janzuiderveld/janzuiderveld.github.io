import ProjectPage from '../components/ProjectPage';
import projectAscii from '../assets/lasers/lasers_ascii.txt?raw';
import projectText from '../assets/lasers/lasers_text.txt?raw';
import projectPhoto from '../assets/lasers/pictures/lasers_placeholder.png';
import { LASERS_ALIGN_DEFAULT } from '../assets/lasers/align';

function LasersPage() {
  return (
    <ProjectPage
      title='Lasers'
      text={projectText}
      asciiArt={projectAscii}
      photo={{ src: projectPhoto, alt: 'Lasers placeholder' }}
      align={LASERS_ALIGN_DEFAULT}
    />
  );
}

export default LasersPage;
