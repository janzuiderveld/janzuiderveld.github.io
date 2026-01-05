import ProjectPage from '../components/ProjectPage';
import projectAscii from '../assets/touching/touching_ascii.txt?raw';
import projectText from '../assets/touching/touching_text.txt?raw';
import projectPhoto from '../assets/touching/pictures/touching_placeholder.png';
import { TOUCHING_ALIGN_DEFAULT } from '../assets/touching/align';

function TouchingDistancePage() {
  return (
    <ProjectPage
      title='Touching Distance'
      text={projectText}
      asciiArt={projectAscii}
      photo={{ src: projectPhoto, alt: 'Touching Distance placeholder' }}
      align={TOUCHING_ALIGN_DEFAULT}
    />
  );
}

export default TouchingDistancePage;
