const VIMEO_EMBED_ORIGIN = 'https://player.vimeo.com';

type VimeoPlaybackCommand =
  | { method: 'setMuted'; value: boolean }
  | { method: 'setVolume'; value: number }
  | { method: 'play' };

const parseVideoUrl = (src: string) => {
  try {
    return new URL(src, VIMEO_EMBED_ORIGIN);
  } catch {
    return null;
  }
};

export const isVimeoEmbedSrc = (src: string) => {
  const url = parseVideoUrl(src);
  return url?.origin === VIMEO_EMBED_ORIGIN && /^\/video\/\d+/.test(url.pathname);
};

const getNormalizedVimeoUrl = (src: string) => {
  if (!isVimeoEmbedSrc(src)) {
    return null;
  }

  const url = parseVideoUrl(src);
  if (!url) {
    return null;
  }

  url.searchParams.set('autoplay', '1');
  if (!url.searchParams.has('muted')) {
    url.searchParams.set('muted', '0');
  }
  url.searchParams.set('playsinline', '1');
  if (!url.searchParams.has('autopause')) {
    url.searchParams.set('autopause', '0');
  }

  return url;
};

export const normalizePhotoVideoEmbedSrc = (src: string) => {
  const url = getNormalizedVimeoUrl(src);
  if (!url) {
    return src;
  }

  return url.toString();
};

const getVimeoPlaybackCommands = (src: string): VimeoPlaybackCommand[] => {
  const url = getNormalizedVimeoUrl(src);
  const shouldMute = url?.searchParams.get('muted') === '1';

  return [
    { method: 'setMuted', value: shouldMute },
    { method: 'setVolume', value: shouldMute ? 0 : 1 },
    { method: 'play' }
  ];
};

export const primePhotoVideoEmbedPlayback = (iframe: HTMLIFrameElement) => {
  const src = iframe.getAttribute('src') ?? iframe.src;
  if (!src || !isVimeoEmbedSrc(src)) {
    return () => {};
  }

  const playbackCommands = getVimeoPlaybackCommands(src);
  const timeouts = [0, 120, 360, 900].map(delay => window.setTimeout(() => {
    const target = iframe.contentWindow;
    if (!target) {
      return;
    }

    playbackCommands.forEach(command => {
      target.postMessage(command, VIMEO_EMBED_ORIGIN);
    });
  }, delay));

  return () => {
    timeouts.forEach(timeout => window.clearTimeout(timeout));
  };
};
