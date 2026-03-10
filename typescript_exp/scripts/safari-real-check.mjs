import fs from 'node:fs/promises';
import path from 'node:path';
import { Builder } from 'selenium-webdriver';
import safari from 'selenium-webdriver/safari.js';

const baseUrl = 'http://localhost:3000';
const settleMs = 2200;
const sampleMs = 4000;
const useTechnologyPreview = process.argv.includes('--technology-preview');
const outputRoot = path.resolve('tmp', 'safari-checks', useTechnologyPreview ? 'technology-preview' : 'safari');

const scenarios = [
  {
    name: 'home-desktop-scroll',
    url: `${baseUrl}/#/`,
    rect: { width: 1280, height: 720 }
  },
  {
    name: 'coffee-desktop-scroll',
    url: `${baseUrl}/#/coffee`,
    rect: { width: 1280, height: 720 }
  },
  {
    name: 'camera-desktop-scroll',
    url: `${baseUrl}/#/camera`,
    rect: { width: 1280, height: 720 }
  },
  {
    name: 'home-tall-idle',
    url: `${baseUrl}/#/`,
    rect: { width: 900, height: 1600 },
    mode: 'idle'
  }
];

const options = new safari.Options();
if (useTechnologyPreview) {
  options.setTechnologyPreview(true);
}

const primeSessionStorage = `
  try {
    sessionStorage.setItem('compatMessageSeen', 'true');
    sessionStorage.setItem('homeIntroRippleSeen', 'true');
    sessionStorage.setItem('sessionInitialized', 'true');
    sessionStorage.removeItem('needsWhiteIn');
    sessionStorage.removeItem('lastWhiteInTimestamp');
  } catch (error) {}
`;

const collectMetrics = async (driver, mode = 'scroll') => {
  return await driver.executeAsyncScript(`
    const mode = arguments[0];
    const sampleMs = arguments[1];
    const done = arguments[arguments.length - 1];

    const frameTimes = [];
    const longTasks = [];
    const start = performance.now();
    let last = start;
    const container = document.querySelector('pre')?.parentElement ?? null;
    let intervalId = null;
    let direction = 1;
    let ticks = 0;

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        longTasks.push(entry.duration);
      }
    });

    try {
      observer.observe({ entryTypes: ['longtask'] });
    } catch (error) {}

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
      const avgFrameMs = frameTimes.reduce((sum, value) => sum + value, 0) / Math.max(frameTimes.length, 1);
      done({
        frames: frameTimes.length,
        avgFrameMs,
        approxFps: avgFrameMs > 0 ? 1000 / avgFrameMs : 0,
        longTaskCount: longTasks.length,
        longTaskMs: longTasks.reduce((sum, value) => sum + value, 0),
        preExists: Boolean(document.querySelector('pre')),
        bodyTextLength: document.body.innerText.length,
        userAgent: navigator.userAgent
      });
    };

    const step = (now) => {
      frameTimes.push(now - last);
      last = now;
      if (now - start >= sampleMs) {
        finish();
        return;
      }
      requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
  `, mode, sampleMs);
};

await fs.mkdir(outputRoot, { recursive: true });

let driver;
try {
  driver = await new Builder()
    .forBrowser('safari')
    .setSafariOptions(options)
    .build();
} catch (error) {
  const message = [
    `Failed to launch ${useTechnologyPreview ? 'Safari Technology Preview' : 'Safari'} WebDriver session.`,
    '',
    'Common fixes:',
    '1. Run `safaridriver --enable` manually in Terminal and enter your password.',
    '2. Open Safari and enable Develop > Allow Remote Automation if Safari prompts for it.',
    '3. If using `--technology-preview`, install Safari Technology Preview first.',
    '',
    `Original error: ${error.message}`
  ].join('\n');
  console.error(message);
  process.exit(1);
}

const results = [];

try {
  await driver.get(`${baseUrl}/#/`);
  await driver.executeScript(primeSessionStorage);

  for (const scenario of scenarios) {
    process.stderr.write(`Running ${scenario.name}\n`);
    try {
      await driver.manage().window().setRect(scenario.rect);
    } catch {
      // Safari may ignore some resize requests; continue with current window size.
    }

    await driver.get(scenario.url);
    await driver.sleep(settleMs);

    const metrics = await collectMetrics(driver, scenario.mode ?? 'scroll');
    const screenshotPath = path.join(outputRoot, `${scenario.name}.png`);
    const screenshot = await driver.takeScreenshot();
    await fs.writeFile(screenshotPath, screenshot, 'base64');

    results.push({
      scenario: scenario.name,
      rect: scenario.rect,
      mode: scenario.mode ?? 'scroll',
      fps: Number(metrics.approxFps.toFixed(1)),
      avgFrameMs: Number(metrics.avgFrameMs.toFixed(2)),
      frames: metrics.frames,
      longTaskCount: metrics.longTaskCount,
      longTaskMs: Number(metrics.longTaskMs.toFixed(1)),
      preExists: metrics.preExists,
      bodyTextLength: metrics.bodyTextLength,
      userAgent: metrics.userAgent,
      screenshot: screenshotPath
    });
  }
} finally {
  await driver.quit();
}

const summaryPath = path.join(outputRoot, 'summary.json');
await fs.writeFile(summaryPath, `${JSON.stringify(results, null, 2)}\n`);
console.log(JSON.stringify(results, null, 2));
