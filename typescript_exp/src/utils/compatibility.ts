export { supportsPrimaryExperienceBrowser } from './browserCapabilities';

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
  'Please visit',
  'w/ a supported browser',
  'for a frictionless experience'
].join('\n');
