import fs from 'node:fs/promises';
import path from 'node:path';
import { webkit } from 'playwright';

const outputRoot = path.resolve('tmp', 'safari-checks', 'webkit');
const baseUrl = 'http://localhost:3000';
const settleMs = 2200;
const sampleMs = 4000;

const scenarios = [
  {
    name: 'home-desktop-idle',
    url: `${baseUrl}/#/`,
    viewport: { width: 1280, height: 720 },
    mode: 'idle'
  },
  {
    name: 'home-desktop-scroll',
    url: `${baseUrl}/#/`,
    viewport: { width: 1280, height: 720 },
    mode: 'scroll'
  },
  {
    name: 'coffee-desktop-idle',
    url: `${baseUrl}/#/coffee`,
    viewport: { width: 1280, height: 720 },
    mode: 'idle'
  },
  {
    name: 'coffee-desktop-scroll',
    url: `${baseUrl}/#/coffee`,
    viewport: { width: 1280, height: 720 },
    mode: 'scroll'
  },
  {
    name: 'camera-desktop-idle',
    url: `${baseUrl}/#/camera`,
    viewport: { width: 1280, height: 720 },
    mode: 'idle'
  },
  {
    name: 'camera-desktop-scroll',
    url: `${baseUrl}/#/camera`,
    viewport: { width: 1280, height: 720 },
    mode: 'scroll'
  },
  {
    name: 'home-tall-idle',
    url: `${baseUrl}/#/`,
    viewport: { width: 900, height: 1600 },
    mode: 'idle'
  }
];

const primeSessionStorage = () => {
  try {
    sessionStorage.setItem('compatMessageSeen', 'true');
    sessionStorage.setItem('homeIntroRippleSeen', 'true');
    sessionStorage.setItem('sessionInitialized', 'true');
    sessionStorage.removeItem('needsWhiteIn');
    sessionStorage.removeItem('lastWhiteInTimestamp');
  } catch {
    // Ignore browser storage errors in automation contexts.
  }
};

const collectMetrics = async (page, mode) => {
  return await page.evaluate(async ({ mode, sampleMs }) => {
    return await new Promise((resolve) => {
      const pageFrameTimes = [];
      const longTasks = [];
      const start = performance.now();
      let last = start;
      const container = document.querySelector('pre')?.parentElement ?? null;
      const pre = document.querySelector('pre');
      let intervalId = null;
      let direction = 1;
      let ticks = 0;
      let redrawCount = 0;
      let redrawLast = 0;
      const redrawIntervals = [];
      const redrawDurations = [];
      let restorePre = null;

      if (pre) {
        const descriptorTargets = [
          Object.getPrototypeOf(pre),
          HTMLElement.prototype,
          Element.prototype
        ];
        let descriptor = null;

        for (const target of descriptorTargets) {
          descriptor = Object.getOwnPropertyDescriptor(target, 'innerHTML');
          if (descriptor?.get && descriptor?.set) {
            break;
          }
        }

        if (descriptor?.get && descriptor?.set) {
          redrawLast = performance.now();
          Object.defineProperty(pre, 'innerHTML', {
            configurable: true,
            enumerable: descriptor.enumerable ?? false,
            get() {
              return descriptor.get.call(this);
            },
            set(value) {
              const now = performance.now();
              if (redrawCount > 0) {
                redrawIntervals.push(now - redrawLast);
              }
              redrawLast = now;
              const writeStart = performance.now();
              descriptor.set.call(this, value);
              redrawDurations.push(performance.now() - writeStart);
              redrawCount += 1;
            }
          });
          restorePre = () => {
            delete pre.innerHTML;
          };
        }
      }

      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          longTasks.push(entry.duration);
        }
      });

      try {
        observer.observe({ entryTypes: ['longtask'] });
      } catch {
        // Older WebKit builds can reject longtask observers.
      }

      if (mode === 'scroll' && container) {
        intervalId = window.setInterval(() => {
          container.dispatchEvent(new WheelEvent('wheel', {
            deltaY: 160 * direction,
            bubbles: true,
            cancelable: true
          }));
          ticks += 1;
          if (ticks % 16 === 0) {
            direction *= -1;
          }
        }, 60);
      }

      const finish = () => {
        observer.disconnect();
        if (intervalId !== null) {
          clearInterval(intervalId);
        }
        restorePre?.();
        const avgFrameMs = pageFrameTimes.reduce((sum, value) => sum + value, 0) / Math.max(pageFrameTimes.length, 1);
        const avgRedrawMs = redrawIntervals.reduce((sum, value) => sum + value, 0) / Math.max(redrawIntervals.length, 1);
        const avgRedrawWriteMs = redrawDurations.reduce((sum, value) => sum + value, 0) / Math.max(redrawDurations.length, 1);
        resolve({
          frames: pageFrameTimes.length,
          avgFrameMs,
          approxFps: avgFrameMs > 0 ? 1000 / avgFrameMs : 0,
          redrawCount,
          avgRedrawMs,
          approxRedrawFps: avgRedrawMs > 0 ? 1000 / avgRedrawMs : 0,
          avgRedrawWriteMs,
          maxRedrawWriteMs: redrawDurations.length ? Math.max(...redrawDurations) : 0,
          longTaskCount: longTasks.length,
          longTaskMs: longTasks.reduce((sum, value) => sum + value, 0),
          preProbeInstalled: Boolean(restorePre),
          preExists: Boolean(document.querySelector('pre')),
          bodyTextLength: document.body.innerText.length
        });
      };

      const step = (now) => {
        pageFrameTimes.push(now - last);
        last = now;

        if (now - start >= sampleMs) {
          finish();
          return;
        }

        requestAnimationFrame(step);
      };

      requestAnimationFrame(step);
    });
  }, { mode, sampleMs });
};

await fs.mkdir(outputRoot, { recursive: true });

const browser = await webkit.launch();
const results = [];

for (const scenario of scenarios) {
  const context = await browser.newContext({
    viewport: scenario.viewport,
    deviceScaleFactor: 1
  });
  await context.addInitScript(primeSessionStorage);

  const page = await context.newPage();
  process.stderr.write(`Running ${scenario.name}\n`);
  await page.goto(scenario.url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(settleMs);

  const metrics = await collectMetrics(page, scenario.mode);
  const screenshotPath = path.join(outputRoot, `${scenario.name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: false });

  results.push({
    scenario: scenario.name,
    viewport: scenario.viewport,
    mode: scenario.mode,
    pageFps: Number(metrics.approxFps.toFixed(1)),
    avgPageFrameMs: Number(metrics.avgFrameMs.toFixed(2)),
    frames: metrics.frames,
    redrawFps: Number(metrics.approxRedrawFps.toFixed(1)),
    avgRedrawMs: Number(metrics.avgRedrawMs.toFixed(2)),
    redrawCount: metrics.redrawCount,
    avgRedrawWriteMs: Number(metrics.avgRedrawWriteMs.toFixed(3)),
    maxRedrawWriteMs: Number(metrics.maxRedrawWriteMs.toFixed(3)),
    longTaskCount: metrics.longTaskCount,
    longTaskMs: Number(metrics.longTaskMs.toFixed(1)),
    preProbeInstalled: metrics.preProbeInstalled,
    preExists: metrics.preExists,
    bodyTextLength: metrics.bodyTextLength,
    screenshot: screenshotPath
  });

  await context.close();
}

await browser.close();

const summaryPath = path.join(outputRoot, 'summary.json');
await fs.writeFile(summaryPath, `${JSON.stringify(results, null, 2)}\n`);
console.log(JSON.stringify(results, null, 2));
