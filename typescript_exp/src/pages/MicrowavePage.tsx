import ProjectPage from '../components/ProjectPage';
import projectAscii from '../assets/microwave/microwave_ascii.txt?raw';
import projectText from '../assets/microwave/microwave_text.txt?raw';
import projectPhoto from '../assets/microwave/pictures/microwave_placeholder.png';
import { MICROWAVE_ALIGN_DEFAULT } from '../assets/microwave/align';

function MicrowavePage() {
  return (
    <ProjectPage
      title='Microwave'
      text={projectText}
      asciiArt={projectAscii}
      photo={{ src: projectPhoto, alt: 'Microwave placeholder' }}
      align={MICROWAVE_ALIGN_DEFAULT}
    />
  );
}

export default MicrowavePage;
