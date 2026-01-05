import ProjectPage from '../components/ProjectPage';
import projectAscii from '../assets/coffee/coffee_ascii.txt?raw';
import projectText from '../assets/coffee/coffee_text.txt?raw';
import projectPhoto from '../assets/coffee/pictures/coffee_placeholder.png';
import { COFFEE_ALIGN_DEFAULT } from '../assets/coffee/align';

function CoffeeMachinePage() {
  return (
    <ProjectPage
      title='Coffee Machine'
      text={projectText}
      asciiArt={projectAscii}
      photo={{ src: projectPhoto, alt: 'Coffee Machine placeholder' }}
      align={COFFEE_ALIGN_DEFAULT}
    />
  );
}

export default CoffeeMachinePage;
