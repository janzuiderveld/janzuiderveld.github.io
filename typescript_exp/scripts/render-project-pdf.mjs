import fs from 'node:fs/promises';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import {
  buildProjectPdfHostedPageUrl,
  computeProjectPdfAlphaMaskBounds,
  computeProjectPdfCanvasDimensions,
  computeProjectPdfCaptureCandidateScore,
  computeProjectPdfPhotoContentBottom,
  computeProjectPdfPhotoLayout,
  computeProjectPdfTitleLinkLayout,
  expandProjectPdfAlphaMask,
  extractProjectPdfSubjectMask,
  resolveProjectPdfContentLayout,
  resolveProjectPdfPrimaryPhotoItem,
  shouldEraseProjectPdfBlobCell
} from './project-pdf-export-utils.mjs';

const executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const baseUrl = 'http://localhost:3000/';
const assetProcessingHostUrl = new URL('pdf-processing-host.html', baseUrl).toString();
const tempRoot = path.resolve('tmp', 'pdfs');
const outputRoot = path.resolve('output', 'pdf');
const defaultPageSize = {
  width: 842,
  height: 1191
};
const renderPixelRatio = 4;
const captureDeviceScaleFactor = 4;
const previewPhotoProcessingDimension = 1400;
const maxProcessedPhotoDimension = 4096;
const captureGrowthFactor = 1.1;
const captureAttempts = 8;
const selectionMargins = {
  x: 48,
  bottom: 60,
  gap: 44
};
const compositionMargins = {
  x: 48,
  bottom: 20,
  gap: 3
};
const minimumPhotoComfort = {
  widthRatio: 0.34,
  heightRatio: 0.34
};
const maxTextBlobPhotoPadding = 72;
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const usage = () => {
  console.error('Usage: npm run render:project-pdf -- <slug-or-hash-route> [--out <output.pdf>]');
  process.exit(1);
};

const sanitizeFileStem = (value) =>
  value
    .trim()
    .replace(/^#\/?/, '')
    .replace(/\?.*$/, '')
    .replace(/^\/+/, '')
    .replace(/[^a-z0-9/_-]+/gi, '-')
    .replace(/\/+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'project';

const parseArgs = () => {
  const args = process.argv.slice(2);
  let routeInput = '';
  let outputPath = '';

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--out') {
      outputPath = args[index + 1] ?? '';
      index += 1;
      continue;
    }
    if (!routeInput) {
      routeInput = arg;
      continue;
    }
    usage();
  }

  if (!routeInput) {
    usage();
  }

  return { routeInput, outputPath };
};

const normalizeHashRoute = (value) => {
  if (value.startsWith('#')) {
    return value;
  }
  if (value.startsWith('/')) {
    return `#${value}`;
  }
  return `#/${value}`;
};

const buildExportUrl = (routeInput) => {
  const hashRoute = normalizeHashRoute(routeInput);
  const [hashPath, rawQuery = ''] = hashRoute.split('?');
  const params = new URLSearchParams(rawQuery);
  params.set('pdf', '1');
  const query = params.toString();
  return `${baseUrl}${hashPath}${query ? `?${query}` : ''}`;
};

const toAbsoluteAssetUrl = (source) => new URL(source, baseUrl).toString();

const buildCaptureViewport = (width) => ({
  width,
  height: Math.round(width * (defaultPageSize.height / defaultPageSize.width))
});

const scaleRect = (rect, scale) => ({
  left: rect.left * scale.x,
  top: rect.top * scale.y,
  width: rect.width * scale.x,
  height: rect.height * scale.y
});

const loadExportScene = async (page, url, captureViewport) => {
  await page.bringToFront();
  await page.setViewport({
    width: captureViewport.width,
    height: captureViewport.height,
    deviceScaleFactor: captureDeviceScaleFactor
  });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('pre', { timeout: 15000 });
  await wait(2200);
  await page.waitForFunction(
    () => Boolean(
      window.__projectPdfExport
      && window.__projectPdfExport.bounds?.padded?.title
      && window.__projectPdfExport.bounds?.padded?.text
    ),
    { timeout: 15000, polling: 100 }
  );
  await page.waitForFunction(() => {
    const pre = document.querySelector('pre');
    const text = pre?.textContent ?? '';
    return text.replace(/\s/g, '').length > 800;
  }, { timeout: 15000, polling: 100 });
  const metadata = await page.evaluate(() => window.__projectPdfExport);
  const contentLayout = resolveProjectPdfContentLayout(metadata);
  const primaryPhotoItem = resolveProjectPdfPrimaryPhotoItem(metadata);
  return { metadata, contentLayout, primaryPhotoItem };
};

const createCompositionHtml = ({
  pageCaptureDataUrl,
  photoFrame,
  photoDataUrl,
  blobMaskDataUrl,
  canvasDimensions,
  charMetrics,
  captureScale,
  hostedPageUrl,
  titleLinkLayout
}) => {
  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <style>
          html, body {
            margin: 0;
            padding: 0;
            background: white;
          }
          body {
            width: ${canvasDimensions.cssWidth}px;
            height: ${canvasDimensions.cssHeight}px;
            overflow: hidden;
            position: relative;
          }
          canvas {
            display: block;
            width: ${canvasDimensions.cssWidth}px;
            height: ${canvasDimensions.cssHeight}px;
          }
          #page-link {
            position: absolute;
            left: ${Math.round(titleLinkLayout.centerX - titleLinkLayout.width / 2)}px;
            top: ${titleLinkLayout.top}px;
            width: ${titleLinkLayout.width}px;
            color: rgb(0, 0, 238);
            font-family: "Courier New", Courier, monospace;
            font-size: ${titleLinkLayout.fontSize}px;
            line-height: ${titleLinkLayout.lineHeight}px;
            text-align: center;
            text-decoration: none;
            z-index: 1;
          }
        </style>
      </head>
      <body>
        <canvas
          id="page-canvas"
          width="${canvasDimensions.width}"
          height="${canvasDimensions.height}"
        ></canvas>
        <a id="page-link" href=${JSON.stringify(hostedPageUrl)}>[link to web page]</a>
        <script>
          const pageCaptureSrc = ${JSON.stringify(pageCaptureDataUrl)};
          const photoSrc = ${JSON.stringify(photoDataUrl)};
          const blobMaskSrc = ${JSON.stringify(blobMaskDataUrl)};
          const photoFrame = ${JSON.stringify(photoFrame)};
          const canvasDimensions = ${JSON.stringify(canvasDimensions)};
          const charMetrics = ${JSON.stringify(charMetrics)};
          const captureScale = ${JSON.stringify(captureScale)};
          const shouldEraseProjectPdfBlobCell = (0, eval)(\`(${shouldEraseProjectPdfBlobCell.toString()})\`);

          const loadImage = (src) => new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = reject;
            image.src = src;
          });

          const buildAlphaIntegral = (rgba, width, height) => {
            const stride = width + 1;
            const integral = new Uint32Array(stride * (height + 1));

            for (let y = 0; y < height; y += 1) {
              let rowSum = 0;
              const sourceRowOffset = y * width * 4;
              const integralRowOffset = (y + 1) * stride;
              const previousRowOffset = y * stride;
              for (let x = 0; x < width; x += 1) {
                rowSum += rgba[sourceRowOffset + x * 4 + 3];
                integral[integralRowOffset + x + 1] = integral[previousRowOffset + x + 1] + rowSum;
              }
            }

            return { integral, stride };
          };

          const sumIntegralRect = (integral, stride, left, top, right, bottom) =>
            integral[bottom * stride + right]
            - integral[top * stride + right]
            - integral[bottom * stride + left]
            + integral[top * stride + left];

          const canvas = document.getElementById('page-canvas');
          const context = canvas.getContext('2d');

          Promise.all([
            loadImage(pageCaptureSrc),
            loadImage(photoSrc),
            loadImage(blobMaskSrc)
          ]).then(([pageCapture, photoImage, blobMaskImage]) => {
            const actualPhotoFrame = {
              x: photoFrame.x * canvasDimensions.pixelRatio,
              y: photoFrame.y * canvasDimensions.pixelRatio,
              width: photoFrame.width * canvasDimensions.pixelRatio,
              height: photoFrame.height * canvasDimensions.pixelRatio
            };

            context.clearRect(0, 0, canvas.width, canvas.height);
            context.fillStyle = 'white';
            context.fillRect(0, 0, canvas.width, canvas.height);
            context.imageSmoothingEnabled = true;
            context.imageSmoothingQuality = 'high';
            context.drawImage(pageCapture, 0, 0, canvas.width, canvas.height);

            const maskWidth = Math.max(1, Math.round(actualPhotoFrame.width));
            const maskHeight = Math.max(1, Math.round(actualPhotoFrame.height));
            const maskCanvas = document.createElement('canvas');
            maskCanvas.width = maskWidth;
            maskCanvas.height = maskHeight;
            const maskContext = maskCanvas.getContext('2d', { willReadFrequently: true });
            maskContext.imageSmoothingEnabled = true;
            maskContext.imageSmoothingQuality = 'high';
            maskContext.clearRect(0, 0, maskWidth, maskHeight);
            maskContext.drawImage(blobMaskImage, 0, 0, maskWidth, maskHeight);

            const maskImageData = maskContext.getImageData(0, 0, maskWidth, maskHeight);
            const { integral, stride } = buildAlphaIntegral(maskImageData.data, maskWidth, maskHeight);
            const cellWidth = Math.max(1, charMetrics.charWidth * captureScale.x * canvasDimensions.pixelRatio);
            const cellHeight = Math.max(1, charMetrics.charHeight * captureScale.y * canvasDimensions.pixelRatio);
            const minCellX = Math.max(0, Math.floor(actualPhotoFrame.x / cellWidth));
            const minCellY = Math.max(0, Math.floor(actualPhotoFrame.y / cellHeight));
            const maxCellX = Math.max(
              minCellX,
              Math.ceil((actualPhotoFrame.x + actualPhotoFrame.width) / cellWidth) - 1
            );
            const maxCellY = Math.max(
              minCellY,
              Math.ceil((actualPhotoFrame.y + actualPhotoFrame.height) / cellHeight) - 1
            );

            context.fillStyle = 'white';

            for (let cellY = minCellY; cellY <= maxCellY; cellY += 1) {
              const cellTop = cellY * cellHeight;
              const cellBottom = Math.min(canvas.height, cellTop + cellHeight);
              const intersectTop = Math.max(cellTop, actualPhotoFrame.y);
              const intersectBottom = Math.min(cellBottom, actualPhotoFrame.y + actualPhotoFrame.height);

              if (intersectBottom <= intersectTop) {
                continue;
              }

              for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
                const cellLeft = cellX * cellWidth;
                const cellRight = Math.min(canvas.width, cellLeft + cellWidth);
                const intersectLeft = Math.max(cellLeft, actualPhotoFrame.x);
                const intersectRight = Math.min(cellRight, actualPhotoFrame.x + actualPhotoFrame.width);

                if (intersectRight <= intersectLeft) {
                  continue;
                }

                const maskLeft = Math.max(0, Math.floor(intersectLeft - actualPhotoFrame.x));
                const maskTop = Math.max(0, Math.floor(intersectTop - actualPhotoFrame.y));
                const maskRight = Math.min(maskWidth, Math.ceil(intersectRight - actualPhotoFrame.x));
                const maskBottom = Math.min(maskHeight, Math.ceil(intersectBottom - actualPhotoFrame.y));

                if (maskRight <= maskLeft || maskBottom <= maskTop) {
                  continue;
                }

                const sampleArea = (maskRight - maskLeft) * (maskBottom - maskTop);
                const alphaSum = sumIntegralRect(
                  integral,
                  stride,
                  maskLeft,
                  maskTop,
                  maskRight,
                  maskBottom
                );
                const coverage = alphaSum / (255 * sampleArea);

                if (!shouldEraseProjectPdfBlobCell({ coverage, cellX, cellY })) {
                  continue;
                }

                context.fillRect(cellLeft, cellTop, cellRight - cellLeft, cellBottom - cellTop);
              }
            }

            context.drawImage(
              photoImage,
              actualPhotoFrame.x,
              actualPhotoFrame.y,
              actualPhotoFrame.width,
              actualPhotoFrame.height
            );

            window.__pdfCompositionReady = true;
          }).catch((error) => {
            console.error(error);
            window.__pdfCompositionError = String(error);
          });
        </script>
      </body>
    </html>
  `;
};

const resolveProcessedPhotoAsset = async (page, primaryPhotoItem, targetMaxDimension) => page.evaluate(
  async ({
    source,
    targetMaxDimension,
    extractProjectPdfSubjectMaskSource,
    expandProjectPdfAlphaMaskSource,
    computeProjectPdfAlphaMaskBoundsSource
  }) => {
    const extractProjectPdfSubjectMask = (0, eval)(`(${extractProjectPdfSubjectMaskSource})`);
    const expandProjectPdfAlphaMask = (0, eval)(`(${expandProjectPdfAlphaMaskSource})`);
    const computeProjectPdfAlphaMaskBounds = (0, eval)(`(${computeProjectPdfAlphaMaskBoundsSource})`);

    const loadImage = (imageSource) => new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = imageSource;
    });

    const image = await loadImage(source);
    const naturalWidth = image.naturalWidth || image.width;
    const naturalHeight = image.naturalHeight || image.height;
    const processingScale = Math.min(1, targetMaxDimension / Math.max(naturalWidth, naturalHeight));
    const width = Math.max(1, Math.round(naturalWidth * processingScale));
    const height = Math.max(1, Math.round(naturalHeight * processingScale));

    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = width;
    sourceCanvas.height = height;
    const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true });
    sourceContext.imageSmoothingEnabled = true;
    sourceContext.imageSmoothingQuality = 'high';
    sourceContext.drawImage(image, 0, 0, width, height);
    const sourceImageData = sourceContext.getImageData(0, 0, width, height);
    const subject = extractProjectPdfSubjectMask({
      rgba: sourceImageData.data,
      width,
      height
    });
    const subjectBounds = subject.bounds ?? {
      minX: 0,
      maxX: width - 1,
      minY: 0,
      maxY: height - 1
    };
    const subjectWidth = subjectBounds.maxX - subjectBounds.minX + 1;
    const subjectHeight = subjectBounds.maxY - subjectBounds.minY + 1;
    const paddingRadius = Math.max(12, Math.round(Math.max(subjectWidth, subjectHeight) * 0.035));
    const blobAlphaMask = expandProjectPdfAlphaMask({
      alphaMask: subject.alphaMask,
      width,
      height,
      radius: paddingRadius
    });
    const blobBounds = computeProjectPdfAlphaMaskBounds(blobAlphaMask, width, height, 1) ?? subjectBounds;
    const processedWidth = blobBounds.maxX - blobBounds.minX + 1;
    const processedHeight = blobBounds.maxY - blobBounds.minY + 1;

    const cleanedCanvas = document.createElement('canvas');
    cleanedCanvas.width = processedWidth;
    cleanedCanvas.height = processedHeight;
    const cleanedContext = cleanedCanvas.getContext('2d');
    const cleanedImageData = cleanedContext.createImageData(processedWidth, processedHeight);

    const blobCanvas = document.createElement('canvas');
    blobCanvas.width = processedWidth;
    blobCanvas.height = processedHeight;
    const blobContext = blobCanvas.getContext('2d');
    const blobImageData = blobContext.createImageData(processedWidth, processedHeight);

    for (let y = blobBounds.minY; y <= blobBounds.maxY; y += 1) {
      for (let x = blobBounds.minX; x <= blobBounds.maxX; x += 1) {
        const sourcePixelIndex = y * width + x;
        const sourceOffset = sourcePixelIndex * 4;
        const destinationPixelIndex = (y - blobBounds.minY) * processedWidth + (x - blobBounds.minX);
        const destinationOffset = destinationPixelIndex * 4;

        const subjectAlpha = subject.alphaMask[sourcePixelIndex];
        if (subjectAlpha > 0) {
          cleanedImageData.data[destinationOffset] = sourceImageData.data[sourceOffset];
          cleanedImageData.data[destinationOffset + 1] = sourceImageData.data[sourceOffset + 1];
          cleanedImageData.data[destinationOffset + 2] = sourceImageData.data[sourceOffset + 2];
          cleanedImageData.data[destinationOffset + 3] = subjectAlpha;
        }

        const blobAlpha = blobAlphaMask[sourcePixelIndex];
        if (blobAlpha > 0) {
          blobImageData.data[destinationOffset + 3] = blobAlpha;
        }
      }
    }

    cleanedContext.putImageData(cleanedImageData, 0, 0);
    blobContext.putImageData(blobImageData, 0, 0);

    return {
      width: processedWidth,
      height: processedHeight,
      naturalWidth,
      naturalHeight,
      processingScale,
      maxDimensionUsed: targetMaxDimension,
      subjectBounds,
      blobBounds,
      paddingRadius,
      photoDataUrl: cleanedCanvas.toDataURL('image/png'),
      blobMaskDataUrl: blobCanvas.toDataURL('image/png')
    };
  },
  {
    source: toAbsoluteAssetUrl(primaryPhotoItem.highSrc),
    targetMaxDimension,
    extractProjectPdfSubjectMaskSource: extractProjectPdfSubjectMask.toString(),
    expandProjectPdfAlphaMaskSource: expandProjectPdfAlphaMask.toString(),
    computeProjectPdfAlphaMaskBoundsSource: computeProjectPdfAlphaMaskBounds.toString()
  }
);

const { routeInput, outputPath } = parseArgs();
const exportUrl = buildExportUrl(routeInput);
const fileStem = sanitizeFileStem(routeInput);
const pdfPath = path.resolve(outputPath || path.join(outputRoot, `${fileStem}-project-page.pdf`));
const pageCapturePath = path.join(tempRoot, `${fileStem}-project-page-source.png`);
const previewScreenshotPath = path.join(tempRoot, `${fileStem}-project-page-preview.png`);
const metadataPath = path.join(tempRoot, `${fileStem}-project-page-layout.json`);

await fs.mkdir(tempRoot, { recursive: true });
await fs.mkdir(path.dirname(pdfPath), { recursive: true });

const browser = await puppeteer.launch({
  executablePath,
  headless: 'new',
  args: [
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding'
  ]
});

let page;
let compositionPage;
let assetProcessingPage;

try {
  page = await browser.newPage();
  assetProcessingPage = await browser.newPage();
  page.setDefaultNavigationTimeout(45000);
  assetProcessingPage.setDefaultNavigationTimeout(45000);
  await assetProcessingPage.goto(assetProcessingHostUrl, { waitUntil: 'domcontentloaded' });

  const minPhotoWidth = Math.round(defaultPageSize.width * minimumPhotoComfort.widthRatio);
  const minPhotoHeight = Math.round(defaultPageSize.height * minimumPhotoComfort.heightRatio);
  let captureViewport = buildCaptureViewport(defaultPageSize.width);
  let previewProcessedPhotoAsset;
  let bestCaptureCandidate = null;

  for (let attempt = 0; attempt < captureAttempts; attempt += 1) {
    const currentCaptureViewport = captureViewport;
    const currentCapture = await loadExportScene(page, exportUrl, currentCaptureViewport);
    if (!previewProcessedPhotoAsset) {
      previewProcessedPhotoAsset = await resolveProcessedPhotoAsset(
        assetProcessingPage,
        currentCapture.primaryPhotoItem,
        previewPhotoProcessingDimension
      );
    }
    const photoAspectRatio = previewProcessedPhotoAsset.width / previewProcessedPhotoAsset.height;
    const currentCaptureScale = {
      x: defaultPageSize.width / currentCaptureViewport.width,
      y: defaultPageSize.height / currentCaptureViewport.height
    };
    const currentSelectionContentBottom = currentCapture.contentLayout.contentBottom * currentCaptureScale.y;

    let currentPhotoFrame = null;
    try {
      currentPhotoFrame = computeProjectPdfPhotoLayout({
        pageWidth: defaultPageSize.width,
        pageHeight: defaultPageSize.height,
        marginX: selectionMargins.x,
        marginBottom: selectionMargins.bottom,
        gap: selectionMargins.gap,
        contentBottom: currentSelectionContentBottom,
        photoAspectRatio
      });
    } catch {
      currentPhotoFrame = null;
    }

    const currentScore = computeProjectPdfCaptureCandidateScore({
      viewportWidth: currentCaptureViewport.width,
      photoFrame: currentPhotoFrame,
      minPhotoWidth,
      minPhotoHeight
    });

    if (
      currentPhotoFrame
      && (
        !bestCaptureCandidate
        || currentScore > bestCaptureCandidate.score
      )
    ) {
      bestCaptureCandidate = {
        score: currentScore,
        captureViewport: currentCaptureViewport,
        captureScale: currentCaptureScale,
        photoFrame: currentPhotoFrame
      };
    }

    captureViewport = buildCaptureViewport(Math.round(currentCaptureViewport.width * captureGrowthFactor));
  }

  if (!bestCaptureCandidate) {
    throw new Error('Unable to fit the project image on a single export page.');
  }

  await page.close();
  page = await browser.newPage();
  page.setDefaultNavigationTimeout(45000);

  const capture = await loadExportScene(page, exportUrl, bestCaptureCandidate.captureViewport);
  const targetPhotoProcessingDimension = Math.min(
    maxProcessedPhotoDimension,
    Math.max(
      2400,
      Math.ceil(
        Math.max(bestCaptureCandidate.photoFrame.width, bestCaptureCandidate.photoFrame.height)
        * renderPixelRatio
        * 1.35
      )
    )
  );
  const processedPhotoAsset = await resolveProcessedPhotoAsset(
    assetProcessingPage,
    capture.primaryPhotoItem,
    targetPhotoProcessingDimension
  );
  const captureScale = bestCaptureCandidate.captureScale;
  const scaledContentBottom = computeProjectPdfPhotoContentBottom({
    textRect: scaleRect(capture.contentLayout.textRect, captureScale),
    paddedTextRect: scaleRect(capture.contentLayout.paddedTextRect, captureScale),
    maxExtraPadding: maxTextBlobPhotoPadding
  });
  const photoAspectRatio = processedPhotoAsset.width / processedPhotoAsset.height;
  const photoFrame = computeProjectPdfPhotoLayout({
    pageWidth: defaultPageSize.width,
    pageHeight: defaultPageSize.height,
    marginX: compositionMargins.x,
    marginBottom: compositionMargins.bottom,
    gap: compositionMargins.gap,
    contentBottom: scaledContentBottom,
    photoAspectRatio
  });
  const selectedCaptureViewport = bestCaptureCandidate.captureViewport;
  const canvasDimensions = computeProjectPdfCanvasDimensions({
    pageWidth: defaultPageSize.width,
    pageHeight: defaultPageSize.height,
    pixelRatio: renderPixelRatio
  });
  const hostedPageUrl = buildProjectPdfHostedPageUrl(routeInput);
  const titleLinkLayout = computeProjectPdfTitleLinkLayout({
    titleRect: scaleRect(capture.contentLayout.titleRect, captureScale),
    paddedTitleRect: scaleRect(capture.contentLayout.paddedTitleRect, captureScale),
    occupiedTitleRects: (capture.contentLayout.titleOccupiedRects ?? []).map(rect => (
      scaleRect(rect, captureScale)
    ))
  });

  const pageCapture = await page.screenshot({
    path: pageCapturePath,
    fullPage: false,
    type: 'png'
  });

  await fs.writeFile(metadataPath, JSON.stringify({
    exportUrl,
    captureViewport: {
      width: selectedCaptureViewport.width,
      height: selectedCaptureViewport.height,
      deviceScaleFactor: captureDeviceScaleFactor
    },
    renderPixelRatio,
    canvasDimensions,
    captureScale,
    contentLayout: capture.contentLayout,
    scaledContentBottom,
    maxTextBlobPhotoPadding,
    hostedPageUrl,
    titleLinkLayout,
    photoFrame,
    photoAspectRatio,
    captureSelectionScore: bestCaptureCandidate.score,
    selectionMargins,
    compositionMargins,
    minimumPhotoComfort,
    targetPhotoProcessingDimension,
    processedPhotoAsset: {
      width: processedPhotoAsset.width,
      height: processedPhotoAsset.height,
      naturalWidth: processedPhotoAsset.naturalWidth,
      naturalHeight: processedPhotoAsset.naturalHeight,
      processingScale: processedPhotoAsset.processingScale,
      maxDimensionUsed: processedPhotoAsset.maxDimensionUsed,
      subjectBounds: processedPhotoAsset.subjectBounds,
      blobBounds: processedPhotoAsset.blobBounds,
      paddingRadius: processedPhotoAsset.paddingRadius
    },
    primaryPhotoItem: capture.primaryPhotoItem,
    metadata: capture.metadata
  }, null, 2));

  compositionPage = await browser.newPage();
  await compositionPage.setViewport({
    width: canvasDimensions.cssWidth,
    height: canvasDimensions.cssHeight,
    deviceScaleFactor: 2
  });
  await compositionPage.setContent(createCompositionHtml({
    pageCaptureDataUrl: `data:image/png;base64,${pageCapture.toString('base64')}`,
    photoFrame,
    photoDataUrl: processedPhotoAsset.photoDataUrl,
    blobMaskDataUrl: processedPhotoAsset.blobMaskDataUrl,
    canvasDimensions,
    charMetrics: capture.metadata.charMetrics,
    captureScale,
    hostedPageUrl,
    titleLinkLayout
  }), { waitUntil: 'load' });
  await compositionPage.waitForFunction(
    () => window.__pdfCompositionReady === true || Boolean(window.__pdfCompositionError),
    { timeout: 15000 }
  );
  const compositionError = await compositionPage.evaluate(() => window.__pdfCompositionError ?? null);
  if (compositionError) {
    throw new Error(`PDF composition failed in browser: ${compositionError}`);
  }
  await compositionPage.screenshot({
    path: previewScreenshotPath,
    fullPage: false,
    type: 'png'
  });
  await compositionPage.pdf({
    path: pdfPath,
    width: `${defaultPageSize.width}px`,
    height: `${defaultPageSize.height}px`,
    printBackground: true,
    margin: {
      top: '0',
      right: '0',
      bottom: '0',
      left: '0'
    }
  });

  console.log(JSON.stringify({
    pdf: pdfPath,
    preview: previewScreenshotPath,
    source: pageCapturePath,
    metadata: metadataPath,
    url: exportUrl
  }, null, 2));
} finally {
  await compositionPage?.close();
  await assetProcessingPage?.close();
  await page?.close();
  await browser.close();
}
