import { AsciiArtConfig } from './config';

export const applyPresetStyles = (config: AsciiArtConfig): React.CSSProperties => {
  return {
    backgroundColor: config.backgroundColor || '#000000',
    color: config.textColor || '#ffffff',
    fontFamily: 'monospace',
    whiteSpace: 'pre',
    lineHeight: '1',
    overflow: 'hidden',
    position: 'relative',
    width: config.maxWidth ? `${config.maxWidth}px` : '100%',
    height: config.maxHeight ? `${config.maxHeight}px` : '100%',
  };
}; 