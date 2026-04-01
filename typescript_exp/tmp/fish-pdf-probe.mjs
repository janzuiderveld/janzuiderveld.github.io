import puppeteer from 'puppeteer-core';
import { extractProjectPdfSubjectMask, expandProjectPdfAlphaMask, computeProjectPdfAlphaMaskBounds } from '../scripts/project-pdf-export-utils.mjs';

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--no-first-run', '--no-default-browser-check']
});
const page = await browser.newPage();
await page.goto('http://localhost:3000/#/fish?pdf=1', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('pre', { timeout: 15000 });
await new Promise(resolve => setTimeout(resolve, 2200));
const result = await page.evaluate(async ({ source, extractSource, expandSource, boundsSource }) => {
  const extract = new Function('return (' + extractSource + ')')();
  const expand = new Function('return (' + expandSource + ')')();
  const bounds = new Function('return (' + boundsSource + ')')();
  const loadImage = (imageSource) => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('image load failed'));
    image.src = imageSource;
  });

  const t0 = performance.now();
  const image = await loadImage(source);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = width;
  sourceCanvas.height = height;
  const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true });
  sourceContext.drawImage(image, 0, 0);
  const sourceImageData = sourceContext.getImageData(0, 0, width, height);
  const t1 = performance.now();
  const subject = extract({ rgba: sourceImageData.data, width, height });
  const t2 = performance.now();
  const subjectBounds = subject.bounds ?? { minX: 0, maxX: width - 1, minY: 0, maxY: height - 1 };
  const paddingRadius = Math.max(14, Math.round(Math.max(subjectBounds.maxX - subjectBounds.minX + 1, subjectBounds.maxY - subjectBounds.minY + 1) * 0.045));
  const blob = expand({ alphaMask: subject.alphaMask, width, height, radius: paddingRadius });
  const blobBounds = bounds(blob, width, height, 1);
  const t3 = performance.now();
  return {
    width,
    height,
    subjectBounds,
    blobBounds,
    paddingRadius,
    timing: {
      load: t1 - t0,
      extract: t2 - t1,
      expand: t3 - t2
    }
  };
}, {
  source: 'http://localhost:3000/src/assets/fish/pictures/fish_placeholder.png',
  extractSource: extractProjectPdfSubjectMask.toString(),
  expandSource: expandProjectPdfAlphaMask.toString(),
  boundsSource: computeProjectPdfAlphaMaskBounds.toString()
});
console.log(JSON.stringify(result, null, 2));
await browser.close();
