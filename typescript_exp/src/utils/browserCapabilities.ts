type NavigatorWithTouch = Navigator & {
  maxTouchPoints?: number;
  userAgentData?: {
    brands?: Array<{ brand: string }>;
  };
};

export const isMobileLikeDevice = () => {
  if (typeof navigator === 'undefined') {
    return false;
  }

  const ua = navigator.userAgent || '';
  const isMobileUA = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
  const isTouchMac = /Macintosh/.test(ua) && (navigator as NavigatorWithTouch).maxTouchPoints > 1;

  return isMobileUA || isTouchMac;
};

export const isSafariBrowser = () => {
  if (typeof navigator === 'undefined') {
    return false;
  }

  const ua = (navigator.userAgent || '').toLowerCase();
  if (!ua.includes('safari')) {
    return false;
  }

  return !['chrome', 'chromium', 'android', 'crios', 'fxios', 'edgios', 'opr', 'opera'].some(token => ua.includes(token));
};

export const isDesktopChromiumBrowser = () => {
  if (typeof navigator === 'undefined') {
    return true;
  }

  if (isMobileLikeDevice()) {
    return false;
  }

  const ua = navigator.userAgent || '';
  const chromiumTokens = ['Chrome', 'Chromium', 'Edg', 'OPR', 'Brave', 'Vivaldi', 'Arc'];
  const uaData = (navigator as NavigatorWithTouch).userAgentData;
  const hasChromiumBrand = uaData?.brands?.some(entry => /Chrom(e|ium)|Edge|Opera|Brave/i.test(entry.brand)) ?? false;

  if (hasChromiumBrand) {
    return true;
  }

  return chromiumTokens.some(token => ua.includes(token));
};

export const supportsPrimaryExperienceBrowser = () => {
  if (typeof navigator === 'undefined') {
    return true;
  }

  return isSafariBrowser() || isDesktopChromiumBrowser();
};

export const supportsHoverInteractions = () => {
  if (typeof window === 'undefined') {
    return true;
  }

  if (typeof window.matchMedia === 'function') {
    return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  }

  return !isMobileLikeDevice();
};
