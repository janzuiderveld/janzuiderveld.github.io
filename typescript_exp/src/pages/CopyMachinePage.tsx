import ProjectPage from '../components/ProjectPage';
import projectAscii from '../assets/copy/copy_ascii.txt?raw';
import projectText from '../assets/copy/copy_text.txt?raw';
import projectPhoto from '../assets/copy/pictures/copy_placeholder.png';
import projectVideo from '../assets/copy/pictures/copy_machine_sequence_720p.mp4';
import instagramReelVideo from '../assets/copy/pictures/copy_machine_instagram_reel.mp4';
import technicalPaperPdf from '../assets/copy/Algorithm_Technical_Paper.pdf';
import { COPY_ALIGN_DEFAULT } from '../assets/copy/align';

const COPY_VIDEO_ANCHOR_NAME = 'hero-video-0';
const COPY_PAGE_TEXT = `${projectText}\n\n[[Technical Paper]](${technicalPaperPdf})`;

function CopyMachinePage() {
  return (
    <ProjectPage
      title='Copy Machine'
      text={COPY_PAGE_TEXT}
      asciiArt={projectAscii}
      photo={{ src: projectPhoto, alt: 'Copy Machine placeholder' }}
      align={COPY_ALIGN_DEFAULT}
      photoVideos={[
        {
          kind: 'file',
          videoSrc: projectVideo,
          alt: 'Copy Machine video',
          position: 'above',
          widthReference: 'page',
          widthScale: 0.48,
          heightRatio: 0.5625,
          gap: 6,
          maxHeight: 36,
          objectFit: 'cover',
          autoplay: true,
          muted: true,
          controls: true,
          playsInline: true
        },
        {
          kind: 'file',
          videoSrc: instagramReelVideo,
          alt: 'Copy Machine Instagram reel',
          position: 'below',
          widthReference: 'page',
          widthScale: 0.24,
          heightRatio: 640 / 360,
          gap: 6,
          maxHeight: 52,
          objectFit: 'cover',
          loop: true,
          controls: true,
          playsInline: true
        }
      ]}
      photoInitialScrollTargetId={COPY_VIDEO_ANCHOR_NAME}
      photoInitialScrollAlignment='start'
      photoInitialScrollPaddingRows={5}
      photoCenterOnEnter
    />
  );
}

export default CopyMachinePage;
