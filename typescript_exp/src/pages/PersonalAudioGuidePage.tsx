import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import ProjectPage from '../components/ProjectPage';
import audioGuideText from '../assets/audio-guide/audio_guide_text.txt?raw';
import audioGuideAscii from '../assets/audio-guide/audio_guide_ascii.txt?raw';
import audioGuidePhoto from '../assets/audio-guide/sign.png';
import audioGuideGalleryPhoto from '../assets/audio-guide/guide_gallery.jpg';

const AUDIO_GUIDE_ALIGN_DEFAULT = {
  offsetX: -20,
  offsetY: -36,
  scaleX: 1.8200000000000007,
  scaleY: 1.8200000000000007,
  stretchX: 1,
  stretchY: 1
} as const;

const DISPLAY_TITLE = 'PERSONAL AUDIO GUIDE';
const SALES_GUIDE_CALLOUT = 'Call +31 97010223622 to speak to our Sales Guide';
const VIMEO_AUDIO_GUIDE_SRC = 'https://player.vimeo.com/video/1171945928?app_id=122963&autoplay=1&muted=0&loop=1&autopause=0&playsinline=1&title=0&byline=0&portrait=0&controls=1';

function PersonalAudioGuidePage() {
  const location = useLocation();

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const hash = window.location.hash || '';
    const shouldNormalizeHash = (
      hash === '#/guide'
      || hash.startsWith('#/guide?')
      || hash === '#/audio-guide'
      || hash.startsWith('#/audio-guide?')
      || hash === '#/personal-audio-guide'
      || hash.startsWith('#/personal-audio-guide?')
    );

    if (!shouldNormalizeHash) {
      return;
    }

    const nextHash = `#guide${location.search || ''}`;
    const nextUrl = `${window.location.pathname}${window.location.search}${nextHash}`;
    window.history.replaceState(window.history.state, '', nextUrl);
  }, [location.search]);

  return (
    <ProjectPage
      title='Personal Audio Guide'
      displayTitle={DISPLAY_TITLE}
      titleFontName='ascii'
      titleCalloutText={SALES_GUIDE_CALLOUT}
      titleCalloutOffsetY={-12}
      hashPathOverride='guide'
      text={audioGuideText}
      asciiArt={audioGuideAscii}
      photo={{ src: audioGuidePhoto, alt: 'Personal Audio Guide sign' }}
      photoVideos={[
        {
          kind: 'embed',
          embedSrc: VIMEO_AUDIO_GUIDE_SRC,
          alt: 'Personal Audio Guide video',
          position: 'above',
          widthReference: 'page',
          widthScale: 0.62,
          heightRatio: 0.5625,
          maxHeight: 54,
          gap: 6
        }
      ]}
      photoImages={[
        {
          src: audioGuideGalleryPhoto,
          alt: 'Visitors standing by the Personal Audio Guide installation',
          position: 'below',
          widthReference: 'page',
          widthScale: 0.68,
          heightRatio: 0.7467,
          maxHeight: 200,
          gap: 8,
          objectFit: 'contain'
        }
      ]}
      align={AUDIO_GUIDE_ALIGN_DEFAULT}
      photoObjectFit='contain'
      inlinePhotoLinkLabel='Video & Photos'
      heroAnchorOffsetY={4}
      photoInitialScrollTargetId='hero-video-0'
      photoInitialScrollAlignment='start'
      photoInitialScrollPaddingRows={5}
      photoCenterOnEnter={true}
    />
  );
}

export default PersonalAudioGuidePage;
