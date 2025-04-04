import { Size, LinkPosition, LinkOverlay, TextPositionCacheResult } from '../../types';

export interface UseLinksParams {
  size: Size;
  textPositionCache: TextPositionCacheResult;
  scrollOffsetRef: React.MutableRefObject<number>;
  startWhiteout: (position: { x: number; y: number }, targetUrl: string) => void;
}

export interface UseLinksResult {
  linkPositions: LinkPosition[];
  linkPositionsRef: React.MutableRefObject<LinkPosition[]>;
  linkClicked: string | null;
  linkOverlays: LinkOverlay[];
  updateLinkOverlays: () => void;
} 