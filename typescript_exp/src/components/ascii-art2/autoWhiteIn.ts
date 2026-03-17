export type AutoWhiteInState = {
  needsWhiteIn: boolean;
  whiteInStarted: boolean;
};

export type AutoWhiteInDecision = {
  pendingSessionWhiteIn: boolean;
  pageAlreadyHandled: boolean;
};

type AutoWhiteInWindow = Window & {
  __asciiAutoWhiteInHandledPage?: string;
};

export const resolveAutoWhiteInState = ({
  pendingSessionWhiteIn,
  pageAlreadyHandled
}: AutoWhiteInDecision): AutoWhiteInState => {
  if (pendingSessionWhiteIn) {
    return {
      needsWhiteIn: false,
      whiteInStarted: false
    };
  }

  if (pageAlreadyHandled) {
    return {
      needsWhiteIn: false,
      whiteInStarted: true
    };
  }

  return {
    needsWhiteIn: true,
    whiteInStarted: false
  };
};

export const hasHandledAutoWhiteInPage = (
  win: Window,
  currentPage: string
) => {
  return (win as AutoWhiteInWindow).__asciiAutoWhiteInHandledPage === currentPage;
};

export const markHandledAutoWhiteInPage = (
  win: Window,
  currentPage: string
) => {
  (win as AutoWhiteInWindow).__asciiAutoWhiteInHandledPage = currentPage;
};
