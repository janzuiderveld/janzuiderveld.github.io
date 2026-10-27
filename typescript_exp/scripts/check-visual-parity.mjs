import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { PNG } = require('../node_modules/playwright-core/lib/utilsBundle.js');
const output = path.resolve('tmp/browser-performance/visual-parity');
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch();
const results = [];
try {
  for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }, { width: 900, height: 1600 }]) {
    for (const route of ['/', '/about', '/coffee', '/camera', '/vending', '/guide', '/biodiesellm']) {
      console.error(`Visual comparison ${viewport.width} ${route}`);
      const captures = [];
      for (const port of [8001, 8000]) {
        const page = await browser.newPage({ viewport });
        await page.addInitScript(() => {
          sessionStorage.setItem('homeIntroRippleSeen', 'true');
          sessionStorage.setItem('sessionInitialized', 'true');
          const raf = requestAnimationFrame;
          window.requestAnimationFrame = callback => raf(time => callback(window.__captureTime ?? time));
        });
        await page.goto(`http://localhost:${port}/#${route}`, { waitUntil: 'load' });
        await page.waitForTimeout(2300);
        await page.evaluate(async () => {
          Date.now = () => 1800000000000;
          // Let any final React effect/cursor handoff settle before the final
          // frozen frame. A single frozen timestamp can strand the old writer
          // after a same-time effect restart on CSV-backed pages such as About.
          for (const time of [100000, 100100, 100200]) {
            window.__captureTime = time;
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        });
        const name = `${viewport.width}-${route.replace(/[^a-z0-9]/gi, '-')}-${port}`;
        const shot = await page.screenshot({ path: path.join(output, `${name}.png`) });
        captures.push({ pixels: PNG.sync.read(shot), text: await page.locator('pre').first().textContent() });
        await page.close();
      }
      const [before, after] = captures;
      assert.equal(before.pixels.width, after.pixels.width);
      assert.equal(before.pixels.height, after.pixels.height);
      let differentPixels = 0;
      for (let i = 0; i < before.pixels.data.length; i += 4) {
        if ([0,1,2,3].some(c => before.pixels.data[i+c] !== after.pixels.data[i+c])) differentPixels++;
      }
      results.push({ viewport, route, equalCharacters: before.text === after.text, differentPixels,
        totalPixels: before.pixels.width * before.pixels.height });
      await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
      console.log(JSON.stringify(results[results.length - 1]));
    }
  }
} finally { await browser.close(); }
assert.ok(results.every(result => result.equalCharacters && result.differentPixels === 0), 'Visual differences require review; see results.json');
