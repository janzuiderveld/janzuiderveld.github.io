import { Size, ClickRipple } from '../../types';

// Extend the interfaces with animation frame support
export interface WhiteoutState {
  active: boolean;
  position: { x: number; y: number };
  timestamp: number;
  targetUrl: string;
  progress: number;
  duration: number;
  justStarted?: boolean;
  animationFrame: number | null;
  startTime: number;
}

export interface WhiteInState {
  active: boolean;
  position: { x: number; y: number };
  timestamp: number;
  progress: number;
  duration: number;
  animationFrame: number | null;
  startTime: number;
}

export interface WhiteOverlayState {
  active: boolean;
  timestamp: number;
  fadeInComplete: boolean;
}

export interface CursorState {
  grid: { x: number; y: number };
  normalized: { x: number; y: number };
  isInWindow: boolean;
  isActive: boolean;
  clickRipples: ClickRipple[];
  whiteout: WhiteoutState | null;
  whiteIn: WhiteInState | null;
  whiteOverlay: WhiteOverlayState | null;
}

export interface MouseDownInfo {
  active: boolean;
  position: { x: number; y: number };
  startTime: number;
}

export interface UseCursorParams {
  textRef: React.RefObject<HTMLPreElement>;
  size: Size;
}

export interface UseCursorResult {
  cursor: CursorState;
  startWhiteout: (position: { x: number; y: number }, targetUrl: string) => void;
  startWhiteIn: (position: { x: number; y: number }) => void;
  activateWhiteOverlay: () => void;
  deactivateWhiteOverlay: () => void;
  simulateClick: (position: { x: number; y: number }) => void;
  updateCursorPosition: (relativeX: number, relativeY: number, isTouchStart?: boolean) => void;
} 