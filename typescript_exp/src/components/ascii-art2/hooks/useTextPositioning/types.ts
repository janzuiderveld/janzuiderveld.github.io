import { FontName } from '../../ASCII_text_renderer';
import { Size, LinkPosition } from '../../types';

export interface TextContentItem {
  text: string;
  x: number;
  y: number;
  fontName?: FontName;
  preRenderedAscii?: string;
  fixed?: boolean;
  maxWidthPercent?: number;
  alignment?: 'left' | 'center' | 'right';
  usePercentPosition?: boolean;
  centered?: boolean;
  name?: string;
  anchorTo?: string;
  anchorOffsetX?: number;
  anchorOffsetY?: number;
  anchorPoint?: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight' | 'center' | 'bottomCenter';
}

export interface UseTextPositioningParams {
  textContent: TextContentItem[];
  size: Size;
  setLinkPositions: React.Dispatch<React.SetStateAction<LinkPosition[]>>;
  linkPositionsRef: React.MutableRefObject<LinkPosition[]>;
}

export interface NamedTextboxes {
  [key: string]: number;
}

export interface LinkData {
  line: number;
  start: number;
  end: number;
  url: string;
} 