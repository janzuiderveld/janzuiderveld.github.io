import fs from 'node:fs/promises';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const outputRoot = path.resolve('tmp', 'animation-profiles');

const scenarios = [
  {
    name: 'home-idle-desktop',
    url: 'http://localhost:3000/#/',
    viewport: { width: 1280, height: 720 },
    cpuRate: 4,
    mode: 'idle'
  },
  {
    name: 'home-scroll-desktop',
    url: 'http://localhost:3000/#/',
    viewport: { width: 1280, height: 720 },
    cpuRate: 4,
    mode: 'scroll'
  },
  {
    name: 'coffee-idle-desktop',
    url: 'http://localhost:3000/#/coffee',
    viewport: { width: 1280, height: 720 },
    cpuRate: 4,
    mode: 'idle'
  },
  {
    name: 'coffee-scroll-desktop',
    url: 'http://localhost:3000/#/coffee',
    viewport: { width: 1280, height: 720 },
    cpuRate: 4,
    mode: 'scroll'
  },
  {
    name: 'camera-idle-desktop',
    url: 'http://localhost:3000/#/camera',
    viewport: { width: 1280, height: 720 },
    cpuRate: 4,
    mode: 'idle'
  },
  {
    name: 'camera-scroll-desktop',
    url: 'http://localhost:3000/#/camera',
    viewport: { width: 1280, height: 720 },
    cpuRate: 4,
    mode: 'scroll'
  }
];

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const summarizeProfile = (profile) => {
  const nodeById = new Map(profile.nodes.map(node => [node.id, node]));
  const totals = new Map();

  for (let index = 0; index < (profile.samples?.length ?? 0); index += 1) {
    const nodeId = profile.samples[index];
    const node = nodeById.get(nodeId);
    if (!node) {
      continue;
    }

    const frame = node.callFrame;
    const functionName = frame.functionName || '(anonymous)';
    const fileName = frame.url || '(inline)';
    const key = `${functionName}@@${fileName}`;
    const durationMs = (profile.timeDeltas?.[index] ?? 0) / 1000;
    totals.set(key, (totals.get(key) ?? 0) + durationMs);
  }

  return [...totals.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 12)
    .map(([key, selfMs]) => {
      const [functionName, fileName] = key.split('@@');
      return {
        functionName,
        fileName,
        selfMs: Number(selfMs.toFixed(1))
      };
    });
};

const formatSample = (scenario, result, topFunctions) => ({
  scenario: scenario.name,
  viewport: scenario.viewport,
  cpuRate: scenario.cpuRate,
  mode: scenario.mode,
  fps: Number(result.approxFps.toFixed(1)),
  avgFrameMs: Number(result.avgFrameMs.toFixed(2)),
  frames: result.frames,
  longTaskCount: result.longTaskCount,
  longTaskMs: Number(result.longTaskMs.toFixed(1)),
  topFunctions
});

const runScenario = async (browser, scenario) => {
  const page = await browser.newPage();
  await page.setViewport({ ...scenario.viewport, deviceScaleFactor: 1 });
  page.setDefaultNavigationTimeout(45000);
  const client = await page.target().createCDPSession();

  await client.send('Performance.enable');
  await client.send('Profiler.enable');
  await client.send('Emulation.setCPUThrottlingRate', { rate: scenario.cpuRate });

  console.error(`Profiling ${scenario.name}`);
  await page.goto(scenario.url, { waitUntil: 'domcontentloaded' });
  await wait(2200);

  const screenshotPath = path.join(outputRoot, `${scenario.name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: false });

  await client.send('Profiler.start');
  const result = await page.evaluate(async ({ mode }) => {
    return await new Promise((resolve) => {
      const frameTimes = [];
      const longTasks = [];
      const start = performance.now();
      let last = start;
      const container = document.querySelector('pre')?.parentElement ?? null;
      let scrollInterval = null;
      let direction = 1;
      let ticks = 0;

      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          longTasks.push(entry.duration);
        }
      });
      observer.observe({ entryTypes: ['longtask'] });

      if (mode === 'scroll' && container) {
        scrollInterval = window.setInterval(() => {
          container.dispatchEvent(new WheelEvent('wheel', {
            deltaY: 150 * direction,
            bubbles: true,
            cancelable: true
          }));
          ticks += 1;
          if (ticks % 18 === 0) {
            direction *= -1;
          }
        }, 50);
      }

      const finish = () => {
        observer.disconnect();
        if (scrollInterval !== null) {
          window.clearInterval(scrollInterval);
        }

        const avgFrameMs = frameTimes.reduce((sum, value) => sum + value, 0) / Math.max(frameTimes.length, 1);
        resolve({
          frames: frameTimes.length,
          avgFrameMs,
          approxFps: avgFrameMs > 0 ? 1000 / avgFrameMs : 0,
          longTaskCount: longTasks.length,
          longTaskMs: longTasks.reduce((sum, value) => sum + value, 0)
        });
      };

      const step = (now) => {
        frameTimes.push(now - last);
        last = now;

        if (now - start >= 5000) {
          finish();
          return;
        }

        requestAnimationFrame(step);
      };

      requestAnimationFrame(step);
    });
  }, { mode: scenario.mode });
  const { profile } = await client.send('Profiler.stop');

  await page.close();
  return formatSample(scenario, result, summarizeProfile(profile));
};

await fs.mkdir(outputRoot, { recursive: true });

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

const results = [];
for (const scenario of scenarios) {
  results.push(await runScenario(browser, scenario));
}

await browser.close();
console.log(JSON.stringify(results, null, 2));
