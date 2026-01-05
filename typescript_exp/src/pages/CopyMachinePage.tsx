import ProjectPage from '../components/ProjectPage';
import projectAscii from '../assets/copy/copy_ascii.txt?raw';
import projectText from '../assets/copy/copy_text.txt?raw';
import projectPhoto from '../assets/copy/pictures/copy_placeholder.png';
import { COPY_ALIGN_DEFAULT } from '../assets/copy/align';

function CopyMachinePage() {
  return (
    <ProjectPage
      title='Copy Machine'
      text={projectText}
      asciiArt={projectAscii}
      photo={{ src: projectPhoto, alt: 'Copy Machine placeholder' }}
      align={COPY_ALIGN_DEFAULT}
    />
  );
}

export default CopyMachinePage;
