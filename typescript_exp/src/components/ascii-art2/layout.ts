import { TextContentItem, TextBox } from './types';

export const generateTextBoxes = (
  textContent: TextContentItem[],
  containerWidth: number,
  containerHeight: number
): TextBox[] => {
  return textContent.map((item) => {
    const x = item.usePercentPosition
      ? (containerWidth * item.x) / 100
      : item.x;
    const y = item.usePercentPosition
      ? (containerHeight * item.y) / 100
      : item.y;

    return {
      text: item.text,
      x,
      y,
      fontName: item.fontName || 'regular',
      preRenderedAscii: item.preRenderedAscii,
      fixed: item.fixed || false,
      maxWidth: item.maxWidthPercent
        ? (containerWidth * item.maxWidthPercent) / 100
        : undefined,
      alignment: item.alignment || 'left',
      centered: item.centered || false,
      name: item.name,
      anchorTo: item.anchorTo,
      anchorOffsetX: item.anchorOffsetX,
      anchorOffsetY: item.anchorOffsetY,
      anchorPoint: item.anchorPoint || 'topLeft',
    };
  });
}; 