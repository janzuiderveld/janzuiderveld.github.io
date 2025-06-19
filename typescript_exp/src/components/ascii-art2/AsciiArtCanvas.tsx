import React, { useRef, useEffect } from 'react';
import { CHAR_WIDTH, CHAR_HEIGHT, selectedCharacterSet } from './constants';
import { AsciiArtGeneratorProps } from './types';

const AsciiArtCanvas: React.FC<AsciiArtGeneratorProps> = ({ textContent }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const atlasRef = useRef<HTMLCanvasElement>(document.createElement('canvas'));
  const charMapRef = useRef<Record<string, { x: number; y: number }>>({});
  // Offscreen buffer for delta rendering and scroll position ref
  const bufferRef = useRef<HTMLCanvasElement>(document.createElement('canvas'));
  const scrollYRef = useRef<number>(0);

  // Build character atlas on mount
  useEffect(() => {
    const chars = selectedCharacterSet;
    const cw = CHAR_WIDTH;
    const ch = CHAR_HEIGHT;
    const perRow = Math.ceil(Math.sqrt(chars.length));
    atlasRef.current.width = perRow * cw;
    atlasRef.current.height = perRow * ch;
    const ctx = atlasRef.current.getContext('2d')!;
    ctx.font = `${ch}px monospace`;
    ctx.textBaseline = 'top';

    chars.split('').forEach((char, i) => {
      const row = Math.floor(i / perRow);
      const col = i % perRow;
      const x = col * cw;
      const y = row * ch;
      ctx.clearRect(x, y, cw, ch);
      ctx.fillText(char, x, y);
      charMapRef.current[char] = { x, y };
    });
  }, []);

  // Delta-buffered render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement!;
    const animCtx = canvas.getContext('2d')!;
    const staticCanvas = bufferRef.current;
    // Initialize canvas sizes
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    staticCanvas.width = width;
    const visibleRows = Math.ceil(height / CHAR_HEIGHT) + 1;
    const bufferRows = visibleRows + 1;
    staticCanvas.height = bufferRows * CHAR_HEIGHT;
    const staticCtx = staticCanvas.getContext('2d')!;
    // Initialize lastBaseRow to current scroll
    const initialScroll = parent.scrollTop;
    const initialBaseRow = Math.floor(initialScroll / CHAR_HEIGHT);
    let lastBaseRow = initialBaseRow;

    // Draw a single text row into the static buffer
    const drawRow = (rowIndex: number, destY: number) => {
      textContent.forEach(item => {
        const lines = item.text.split('\n');
        lines.forEach((line, i) => {
          if (item.y + i !== rowIndex) return;
          Array.from(line).forEach((char, j) => {
            const map = charMapRef.current[char] || charMapRef.current[' '];
            staticCtx.drawImage(
              atlasRef.current,
              map.x, map.y, CHAR_WIDTH, CHAR_HEIGHT,
              (item.x + j) * CHAR_WIDTH, destY,
              CHAR_WIDTH, CHAR_HEIGHT
            );
          });
        });
      });
    };

    // Initial buffer fill for the rows around current scroll
    for (let i = 0; i < bufferRows; i++) {
      drawRow(initialBaseRow + i, i * CHAR_HEIGHT);
    }

    // Track scroll position only
    const handleScroll = () => {
      scrollYRef.current = parent.scrollTop;
    };
    parent.addEventListener('scroll', handleScroll, { passive: true });

    let animationFrameId: number;
    const frame = () => {
      const scrollY = scrollYRef.current;
      const baseRow = Math.floor(scrollY / CHAR_HEIGHT);
      const rowOffset = scrollY - baseRow * CHAR_HEIGHT;
      const deltaRows = baseRow - lastBaseRow;

      // If we've moved down, shift buffer up and draw new bottom rows
      if (deltaRows > 0) {
        const shiftPx = deltaRows * CHAR_HEIGHT;
        staticCtx.drawImage(
          staticCanvas,
          0, shiftPx,
          width, staticCanvas.height - shiftPx,
          0, 0,
          width, staticCanvas.height - shiftPx
        );
        staticCtx.clearRect(0, staticCanvas.height - shiftPx, width, shiftPx);
        for (let i = 0; i < deltaRows; i++) {
          drawRow(baseRow + visibleRows + i, (visibleRows + i) * CHAR_HEIGHT);
        }
      }
      // If we've moved up, shift buffer down and draw new top rows
      else if (deltaRows < 0) {
        const d = -deltaRows;
        const shiftPx = d * CHAR_HEIGHT;
        staticCtx.drawImage(
          staticCanvas,
          0, 0,
          width, staticCanvas.height - shiftPx,
          0, shiftPx,
          width, staticCanvas.height - shiftPx
        );
        staticCtx.clearRect(0, 0, width, shiftPx);
        for (let i = 0; i < d; i++) {
          drawRow(baseRow + i, i * CHAR_HEIGHT);
        }
      }
      lastBaseRow = baseRow;

      // Blit the static buffer to the on-screen canvas with fractional offset
      animCtx.clearRect(0, 0, width, height);
      animCtx.drawImage(staticCanvas, 0, -rowOffset);
      animationFrameId = requestAnimationFrame(frame);
    };
    animationFrameId = requestAnimationFrame(frame);

    return () => {
      parent.removeEventListener('scroll', handleScroll);
      cancelAnimationFrame(animationFrameId);
    };
  }, [textContent]);

  return (
    <canvas
      ref={canvasRef}
      width={window.innerWidth}
      height={window.innerHeight}
      style={{ display: 'block', width: '100%', height: '100%' }}
    />
  );
};

export default AsciiArtCanvas; 