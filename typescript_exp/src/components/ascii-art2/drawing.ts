import React from 'react';

export const drawLine = (
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  char: string = '█'
): string[] => {
  const points: string[] = [];
  const dx = Math.abs(endX - startX);
  const dy = Math.abs(endY - startY);
  const sx = startX < endX ? 1 : -1;
  const sy = startY < endY ? 1 : -1;
  let err = dx - dy;

  let x = startX;
  let y = startY;

  while (true) {
    points.push(char);
    if (x === endX && y === endY) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }

  return points;
};

export const drawCharacter = (
  char: string,
  x: number,
  y: number,
  style: React.CSSProperties = {}
): React.ReactElement => {
  return React.createElement(
    'span',
    {
      key: `${x}-${y}`,
      style: {
        position: 'absolute',
        left: `${x}ch`,
        top: `${y}ch`,
        ...style,
      },
    },
    char
  );
};

export const getCharacterDimensions = (): { width: number; height: number } => {
  // For monospace fonts, all characters have the same dimensions
  return {
    width: 1,
    height: 1,
  };
}; 