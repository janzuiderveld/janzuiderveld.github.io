import ProjectPage from '../components/ProjectPage';
import projectAscii from '../assets/biodiesellm/biodiesellm_ascii.txt?raw';
import projectText from '../assets/biodiesellm/biodiesellm_text.txt?raw';
import projectPhoto from '../assets/biodiesellm/pictures/biodiesellm_prototype.jpg';
import { BIODIESELLM_ALIGN_DEFAULT } from '../assets/biodiesellm/align';

function BiodieseLLMPage() {
  return (
    <ProjectPage
      title='B10d13$3LLM'
      displayTitle='B10d13$3LLM'
      titleFontName='ascii'
      text={projectText}
      asciiArt={projectAscii.replace(/^\n+|\n+$/g, '')}
      photo={{
        src: projectPhoto,
        alt: 'B10d13$3LLM receipt printer prototype printing generated plans'
      }}
      align={BIODIESELLM_ALIGN_DEFAULT}
      photoObjectFit='cover'
      inlinePhotoLinkLabel='Prototype Photo'
    />
  );
}

export default BiodieseLLMPage;
