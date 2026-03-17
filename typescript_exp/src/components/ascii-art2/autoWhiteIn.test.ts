import { describe, expect, it } from 'vitest';
import {
  hasHandledAutoWhiteInPage,
  markHandledAutoWhiteInPage,
  resolveAutoWhiteInState
} from './autoWhiteIn';

describe('autoWhiteIn', () => {
  it('keeps the fallback white-in disabled while a session-driven white-in is still pending', () => {
    expect(
      resolveAutoWhiteInState({
        pendingSessionWhiteIn: true,
        pageAlreadyHandled: false
      })
    ).toEqual({
      needsWhiteIn: false,
      whiteInStarted: false
    });
  });

  it('treats the current page as already covered once its load white-in has run', () => {
    expect(
      resolveAutoWhiteInState({
        pendingSessionWhiteIn: false,
        pageAlreadyHandled: true
      })
    ).toEqual({
      needsWhiteIn: false,
      whiteInStarted: true
    });
  });

  it('stores the handled page key on the window for later remounts', () => {
    const win = {} as Window;

    expect(hasHandledAutoWhiteInPage(win, 'http://localhost:3000/#/')).toBe(false);

    markHandledAutoWhiteInPage(win, 'http://localhost:3000/#/');

    expect(hasHandledAutoWhiteInPage(win, 'http://localhost:3000/#/')).toBe(true);
    expect(hasHandledAutoWhiteInPage(win, 'http://localhost:3000/#/about')).toBe(false);
  });
});
