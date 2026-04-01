const boundToRect = (bounds, charMetrics) => ({
  left: bounds.minX * charMetrics.charWidth,
  top: bounds.minY * charMetrics.charHeight,
  width: (bounds.maxX - bounds.minX + 1) * charMetrics.charWidth,
  height: (bounds.maxY - bounds.minY + 1) * charMetrics.charHeight
});

const boundToOptionalRect = (bounds, charMetrics) => (
  bounds ? boundToRect(bounds, charMetrics) : null
);

const rectRight = (rect) => rect.left + rect.width;
const rectBottom = (rect) => rect.top + rect.height;
const backgroundWhiteThreshold = 245;
const backgroundSaturationThreshold = 18;
const backgroundAlphaThreshold = 8;
const hostedPdfOrigin = 'https://warana.xyz/';

const normalizeProjectPdfHashRoute = (value) => {
  if (value.startsWith('#')) {
    return value;
  }
  if (value.startsWith('/')) {
    return `#${value}`;
  }
  return `#/${value}`;
};

export const buildProjectPdfHostedPageUrl = (routeInput, origin = hostedPdfOrigin) => {
  const hashRoute = normalizeProjectPdfHashRoute(routeInput);
  const [hashPath, rawQuery = ''] = hashRoute.split('?');
  const params = new URLSearchParams(rawQuery);
  params.delete('pdf');
  params.delete('pdfbg');
  const query = params.toString();
  return `${origin}${hashPath}${query ? `?${query}` : ''}`;
};

export const computeProjectPdfCanvasDimensions = ({
  pageWidth,
  pageHeight,
  pixelRatio
}) => ({
  width: Math.max(1, Math.round(pageWidth * pixelRatio)),
  height: Math.max(1, Math.round(pageHeight * pixelRatio)),
  cssWidth: pageWidth,
  cssHeight: pageHeight,
  pixelRatio
});

export const computeProjectPdfCaptureCandidateScore = ({
  viewportWidth,
  photoFrame,
  minPhotoWidth,
  minPhotoHeight
}) => {
  if (!photoFrame?.width || !photoFrame?.height) {
    return Number.NEGATIVE_INFINITY;
  }

  const photoArea = photoFrame.width * photoFrame.height;
  const meetsComfortThreshold = photoFrame.width >= minPhotoWidth
    && photoFrame.height >= minPhotoHeight;

  if (meetsComfortThreshold) {
    return 1_000_000_000 - viewportWidth * 1_000_000 + photoArea;
  }

  return photoArea - viewportWidth;
};

const clampInset = (value) => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(0.95, Math.max(0, value));
};

export const resolveProjectPdfContentLayout = (exportMetadata) => {
  const paddedBounds = exportMetadata?.bounds?.padded ?? {};
  const rawBounds = exportMetadata?.bounds?.raw ?? {};
  const charMetrics = exportMetadata?.charMetrics;
  if (!charMetrics || !paddedBounds.title || !paddedBounds.text) {
    throw new Error('Missing export metadata for title or text bounds.');
  }

  const titleRect = boundToRect(rawBounds.title ?? paddedBounds.title, charMetrics);
  const textRect = boundToRect(rawBounds.text ?? paddedBounds.text, charMetrics);
  const paddedTextRect = boundToRect(paddedBounds.text ?? rawBounds.text, charMetrics);
  const titleOccupiedRects = ['title-callout', 'inline-photo-link']
    .map((name) => boundToOptionalRect(rawBounds[name] ?? paddedBounds[name], charMetrics))
    .filter(Boolean);

  return {
    titleRect,
    paddedTitleRect: boundToRect(paddedBounds.title ?? rawBounds.title, charMetrics),
    titleOccupiedRects,
    textRect,
    paddedTextRect,
    contentBottom: rectBottom(paddedTextRect)
  };
};

export const computeProjectPdfPhotoContentBottom = ({
  textRect,
  paddedTextRect,
  maxExtraPadding = 72
}) => {
  const rawBottom = rectBottom(textRect);
  const paddedBottom = rectBottom(paddedTextRect ?? textRect);
  return Math.min(paddedBottom, rawBottom + maxExtraPadding);
};

export const computeProjectPdfTitleLinkLayout = ({
  titleRect,
  paddedTitleRect,
  occupiedTitleRects = []
}) => {
  const safePaddedTitleRect = paddedTitleRect ?? titleRect;
  const width = Math.round(safePaddedTitleRect.width * 0.9);
  const fontSize = Math.round(Math.max(14, Math.min(20, titleRect.height * 0.38)));
  const lineHeight = Math.round(fontSize * 1.2);
  const occupiedBottom = [titleRect, ...occupiedTitleRects]
    .filter(Boolean)
    .reduce((maxBottom, rect) => Math.max(maxBottom, rectBottom(rect)), rectBottom(titleRect));
  const top = Math.round(Math.min(
    occupiedBottom + 12,
    safePaddedTitleRect.top + safePaddedTitleRect.height - lineHeight - 8
  ));

  return {
    centerX: Math.round(safePaddedTitleRect.left + safePaddedTitleRect.width / 2),
    top,
    width,
    fontSize,
    lineHeight
  };
};

const isImagePhotoItem = (item) => item && item.mediaType !== 'video' && item.highSrc && item.lowSrc;

export const resolveProjectPdfPrimaryPhotoItem = (exportMetadata) => {
  const photoItems = Array.isArray(exportMetadata?.photoItems) ? exportMetadata.photoItems : [];
  const requestedId = exportMetadata?.primaryPhotoItemId;

  if (requestedId) {
    const requestedItem = photoItems.find(item => item?.id === requestedId);
    if (isImagePhotoItem(requestedItem)) {
      return requestedItem;
    }
  }

  const primaryPhotoItem = exportMetadata?.primaryPhotoItem;
  if (isImagePhotoItem(primaryPhotoItem)) {
    return primaryPhotoItem;
  }

  const firstImageItem = photoItems.find(isImagePhotoItem);
  if (firstImageItem) {
    return firstImageItem;
  }

  throw new Error('Missing export metadata for the primary photo item.');
};

export const computeProjectPdfPhotoLayout = ({
  pageWidth,
  pageHeight,
  marginX,
  marginBottom,
  contentBottom,
  gap,
  photoAspectRatio
}) => {
  const availableWidth = pageWidth - marginX * 2;
  const top = contentBottom + gap;
  const availableHeight = pageHeight - marginBottom - top;
  if (availableWidth <= 0 || availableHeight <= 0) {
    throw new Error('Not enough room to place the project photo on the page.');
  }

  const safeAspectRatio = Number.isFinite(photoAspectRatio) && photoAspectRatio > 0
    ? photoAspectRatio
    : 1;
  const width = Math.min(availableWidth, availableHeight * safeAspectRatio);
  const height = width / safeAspectRatio;
  const extraVerticalSpace = Math.max(0, availableHeight - height);

  return {
    x: Math.round((pageWidth - width) / 2),
    y: Math.round(top + extraVerticalSpace / 2),
    width: Math.round(width),
    height: Math.round(height)
  };
};

export const shouldEraseProjectPdfBlobCell = ({
  coverage,
  cellX,
  cellY,
  solidThreshold = 0.6,
  edgeThreshold = 0.1
}) => {
  if (coverage >= solidThreshold) {
    return true;
  }

  if (coverage <= edgeThreshold) {
    return false;
  }

  const normalizedCoverage = (coverage - edgeThreshold) / (solidThreshold - edgeThreshold);
  const noise = ((((cellX + 1) * 37) + ((cellY + 1) * 17)) % 100) / 100;
  return normalizedCoverage > noise;
};

export const normalizeProjectPdfPhotoInsets = (insets) => {
  if (!insets) {
    return undefined;
  }

  let left = clampInset(insets.left);
  let right = clampInset(insets.right);
  let top = clampInset(insets.top);
  let bottom = clampInset(insets.bottom);

  const horizontalTotal = left + right;
  if (horizontalTotal >= 0.95) {
    const scale = 0.95 / horizontalTotal;
    left *= scale;
    right *= scale;
  }

  const verticalTotal = top + bottom;
  if (verticalTotal >= 0.95) {
    const scale = 0.95 / verticalTotal;
    top *= scale;
    bottom *= scale;
  }

  if (left === 0 && right === 0 && top === 0 && bottom === 0) {
    return undefined;
  }

  return { top, right, bottom, left };
};

export const resolveProjectPdfPhotoCropFrameStyle = (insets) => {
  const normalizedInsets = normalizeProjectPdfPhotoInsets(insets);
  if (!normalizedInsets) {
    return null;
  }

  const visibleWidth = 1 - normalizedInsets.left - normalizedInsets.right;
  const visibleHeight = 1 - normalizedInsets.top - normalizedInsets.bottom;
  const cropScale = Math.max(1 / visibleWidth, 1 / visibleHeight);
  const centerX = normalizedInsets.left + visibleWidth / 2;
  const centerY = normalizedInsets.top + visibleHeight / 2;

  return {
    widthPercent: cropScale * 100,
    heightPercent: cropScale * 100,
    leftPercent: (0.5 - centerX * cropScale) * 100,
    topPercent: (0.5 - centerY * cropScale) * 100
  };
};

const isProjectPdfBackgroundCandidate = (rgba, pixelOffset) => {
  const alpha = rgba[pixelOffset + 3];
  if (alpha <= backgroundAlphaThreshold) {
    return true;
  }

  const red = rgba[pixelOffset];
  const green = rgba[pixelOffset + 1];
  const blue = rgba[pixelOffset + 2];
  const minChannel = Math.min(red, green, blue);
  const maxChannel = Math.max(red, green, blue);

  return minChannel >= backgroundWhiteThreshold
    && (maxChannel - minChannel) <= backgroundSaturationThreshold;
};

export const computeProjectPdfAlphaMaskBounds = (alphaMask, width, height, threshold = 8) => {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = alphaMask[y * width + x];
      if (alpha <= threshold) {
        continue;
      }
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < 0 || maxY < 0) {
    return null;
  }

  return { minX, maxX, minY, maxY };
};

export const extractProjectPdfSubjectMask = ({ rgba, width, height }) => {
  const localBackgroundWhiteThreshold = 245;
  const localBackgroundSaturationThreshold = 18;
  const localBackgroundAlphaThreshold = 8;
  const isBackgroundCandidate = (pixelOffset) => {
    const alpha = rgba[pixelOffset + 3];
    if (alpha <= localBackgroundAlphaThreshold) {
      return true;
    }

    const red = rgba[pixelOffset];
    const green = rgba[pixelOffset + 1];
    const blue = rgba[pixelOffset + 2];
    const minChannel = Math.min(red, green, blue);
    const maxChannel = Math.max(red, green, blue);

    return minChannel >= localBackgroundWhiteThreshold
      && (maxChannel - minChannel) <= localBackgroundSaturationThreshold;
  };
  const pixelCount = width * height;
  const visited = new Uint8Array(pixelCount);
  const background = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  let queueStart = 0;
  let queueEnd = 0;

  const enqueueIfBackground = (x, y) => {
    if (x < 0 || x >= width || y < 0 || y >= height) {
      return;
    }

    const index = y * width + x;
    if (visited[index]) {
      return;
    }
    visited[index] = 1;
    if (!isBackgroundCandidate(index * 4)) {
      return;
    }
    background[index] = 1;
    queue[queueEnd] = index;
    queueEnd += 1;
  };

  for (let x = 0; x < width; x += 1) {
    enqueueIfBackground(x, 0);
    enqueueIfBackground(x, height - 1);
  }
  for (let y = 1; y < height - 1; y += 1) {
    enqueueIfBackground(0, y);
    enqueueIfBackground(width - 1, y);
  }

  while (queueStart < queueEnd) {
    const index = queue[queueStart];
    queueStart += 1;
    const x = index % width;
    const y = Math.floor(index / width);
    enqueueIfBackground(x - 1, y);
    enqueueIfBackground(x + 1, y);
    enqueueIfBackground(x, y - 1);
    enqueueIfBackground(x, y + 1);
  }

  const alphaMask = new Uint8ClampedArray(pixelCount);
  for (let index = 0; index < pixelCount; index += 1) {
    if (!background[index]) {
      alphaMask[index] = rgba[index * 4 + 3];
    }
  }

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = alphaMask[y * width + x];
      if (alpha <= localBackgroundAlphaThreshold) {
        continue;
      }
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  return {
    alphaMask,
    bounds: maxX >= 0 && maxY >= 0
      ? { minX, maxX, minY, maxY }
      : null
  };
};

export const expandProjectPdfAlphaMask = ({ alphaMask, width, height, radius }) => {
  const safeRadius = Math.max(0, Math.round(radius));
  if (safeRadius === 0) {
    return new Uint8ClampedArray(alphaMask);
  }

  const horizontalPass = new Uint8ClampedArray(width * height);
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * width;
    for (let x = 0; x < width; x += 1) {
      let maxAlpha = 0;
      const minX = Math.max(0, x - safeRadius);
      const maxX = Math.min(width - 1, x + safeRadius);
      for (let sampleX = minX; sampleX <= maxX; sampleX += 1) {
        maxAlpha = Math.max(maxAlpha, alphaMask[rowOffset + sampleX]);
        if (maxAlpha === 255) {
          break;
        }
      }
      horizontalPass[rowOffset + x] = maxAlpha;
    }
  }

  const expanded = new Uint8ClampedArray(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let maxAlpha = 0;
      const minY = Math.max(0, y - safeRadius);
      const maxY = Math.min(height - 1, y + safeRadius);
      for (let sampleY = minY; sampleY <= maxY; sampleY += 1) {
        maxAlpha = Math.max(maxAlpha, horizontalPass[sampleY * width + x]);
        if (maxAlpha === 255) {
          break;
        }
      }
      expanded[y * width + x] = maxAlpha;
    }
  }

  return expanded;
};
