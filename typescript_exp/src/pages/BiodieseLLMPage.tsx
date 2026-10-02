import { useLocation } from 'react-router-dom';
import hoverPhoto from '../assets/biodiesellm/pictures/biodiesellm_hover_white.png';
import ProjectPage from '../components/ProjectPage';
import projectAscii from '../assets/biodiesellm/biodiesellm_ascii.txt?raw';
import projectText from '../assets/biodiesellm/biodiesellm_text.txt?raw';
import projectPhoto from '../assets/biodiesellm/pictures/biodiesellm_ars2026_overview.jpg';
import performancePhoto from '../assets/biodiesellm/pictures/biodiesellm_ars2026_performance.jpg';
import detailPhoto from '../assets/biodiesellm/pictures/biodiesellm_ars2026_detail.jpg';
import { BIODIESELLM_ALIGN_DEFAULT } from '../assets/biodiesellm/align';

function BiodieseLLMPage() {
  const { search } = useLocation();
  const documentaryMode = ['1', 'true', 'on', 'yes'].includes(new URLSearchParams(search).get('photo')?.toLowerCase() ?? '');
  return (
    <ProjectPage
      title='B10d13$3L-LLM'
      displayTitle='B10d13$3L-LLM'
      titleFontName='ascii'
      text={projectText}
      asciiArt={projectAscii.replace(/^\n+|\n+$/g, '')}
      photo={{
        src: documentaryMode ? projectPhoto : hoverPhoto,
        contentInsets: documentaryMode ? undefined : { left: 1 / 6, right: 0.1510416667, top: 0.01953125, bottom: 0.0048828125 },
        alt: documentaryMode
          ? 'B10d13$3L-LLM by Gökay Atabek at Ars Electronica 2026: installation overview. Photo: Tom Mesic.'
          : 'B10d13$3L-LLM, AI-edited white-background presentation with reconstructed roof, based on a photograph by Tom Mesic.'
      }}
      align={BIODIESELLM_ALIGN_DEFAULT}
      photoObjectFit='contain'
      photoCenterOnEnter
      photoInitialScrollTargetId='hero-video-image-0'
      photoInitialScrollAlignment='start'
      photoInitialScrollPaddingRows={5}
      photoImages={[
        {
          src: performancePhoto,
          alt: 'B10d13$3L-LLM by Gökay Atabek at Ars Electronica 2026: performance beside the diesel engine. Photo: Tom Mesic.',
          position: 'above',
          widthReference: 'page',
          widthScale: 0.8,
          heightRatio: 2 / 3,
          gap: 4,
          objectFit: 'contain'
        },
        {
          src: detailPhoto,
          alt: 'B10d13$3L-LLM by Gökay Atabek at Ars Electronica 2026: controls and printed output. Photo: Tom Mesic.',
          position: 'below',
          widthReference: 'page',
          widthScale: 0.8,
          heightRatio: 2 / 3,
          gap: 4,
          objectFit: 'contain'
        }
      ]}
    />
  );
}

export default BiodieseLLMPage;
