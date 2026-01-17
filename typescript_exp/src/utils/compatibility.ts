type NavigatorWithUAData = Navigator & {
  userAgentData?: {
    brands?: Array<{ brand: string }>;
  };
};

export const isDesktopChromium = () => {
  if (typeof navigator === 'undefined') {
    return true;
  }

  const ua = navigator.userAgent || '';
  const touchMac = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  const isDesktop = !/Mobi|Android|iPhone|iPad/i.test(ua) && !touchMac;
  const chromiumTokens = ['Chrome', 'Chromium', 'Edg', 'OPR', 'Brave', 'Vivaldi', 'Arc'];

  const uaData = (navigator as NavigatorWithUAData).userAgentData;
  const hasChromiumBrand = uaData?.brands?.some(entry => /Chrom(e|ium)|Edge|Opera|Brave/i.test(entry.brand)) ?? false;

  if (!isDesktop) {
    return false;
  }

  if (hasChromiumBrand) {
    return true;
  }

  return chromiumTokens.some(token => ua.includes(token));
};

export const hasSeenCompatibilityMessage = () => {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    return sessionStorage.getItem('compatMessageSeen') === 'true';
  } catch (error) {
    console.warn('Unable to read compatibility message flag', error);
    return false;
  }
};

export const markCompatibilityMessageSeen = () => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    sessionStorage.setItem('compatMessageSeen', 'true');
  } catch (error) {
    console.warn('Unable to store compatibility message flag', error);
  }
};

export const COMPATIBILITY_MESSAGE = [
  'Please visit on desktop',
  'w/ a chromium based browser',
  'for a frictionless experience'
].join('\n');
