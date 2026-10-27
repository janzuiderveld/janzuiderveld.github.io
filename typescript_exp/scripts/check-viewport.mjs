// Browser rotation/edge coverage plus the iOS opt-in that headless engines cannot emulate.
import { chromium, firefox, webkit } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base = process.env.PREVIEW_URL || 'http://localhost:8000';
const output = process.env.CHECK_OUTPUT || 'tmp/browser-verification/viewport';
const engines = (process.env.CHECK_ENGINES || 'chrome,firefox,webkit').split(',');
await fs.mkdir(output, { recursive: true });
const results = [];
for (const engine of engines) {
  const browser = await ({ chrome: chromium, firefox, webkit })[engine].launch(engine === 'chrome'
    ? { executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' } : {});
  try {
    const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true,
      ...(engine === 'firefox' ? {} : { isMobile: true }) });
    await context.addInitScript(() => {
      sessionStorage.setItem('homeIntroRippleSeen', 'true');
      sessionStorage.setItem('sessionInitialized', 'true');
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const route of ['/', '/coffee']) {
      await page.goto(`${base}/#${route}`, { waitUntil: 'load' });
      assert.match(await page.locator('meta[name="viewport"]').getAttribute('content'),
        /(?:^|,)\s*viewport-fit\s*=\s*cover\s*(?:,|$)/,
        `${engine}: iOS must allow drawing into the landscape side areas`);
      // Rotate the same loaded page so stale portrait dimensions cannot pass.
      for (const [width, height] of [[844, 390], [390, 844], [932, 430], [1280, 720]]) {
        await page.setViewportSize({ width, height });
        await page.waitForTimeout(2400);
        const samples = await page.evaluate(async () => {
          const pre = document.querySelector('pre');
          const sample = () => {
            const style = getComputedStyle(pre);
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            ctx.font = style.font;
            const charWidth = ctx.measureText('M').width;
            const cols = Math.floor(innerWidth / charWidth);
            const rows = pre.textContent.split('\n').slice(0, Math.ceil(innerHeight / parseFloat(style.lineHeight)));
            const rect = pre.getBoundingClientRect();
            return { width: innerWidth, visualWidth: visualViewport?.width ?? innerWidth,
              left: rect.left, right: rect.right, charWidth,
              renderedWidth: Math.max(...rows.map(row => row.length)) * charWidth,
              leftEdge: rows.map(row => row.slice(0, 6)).join(''),
              rightEdge: rows.map(row => row.slice(Math.max(0, cols - 6), cols)).join('') };
          };
          const first = sample();
          await new Promise(resolve => setTimeout(resolve, 650));
          return [first, sample()];
        });
        const [first, last] = samples;
        const name = `${engine}-${route === '/' ? 'home' : 'coffee'}-${width}x${height}`;
        assert.ok(Math.abs(last.visualWidth - width) < 1 && Math.abs(last.width - width) < 1, `${name}: viewport width`);
        assert.ok(last.left <= 0 && last.right >= width, `${name}: ASCII layer must reach both edges`);
        assert.ok(last.renderedWidth >= width - last.charWidth - 1, `${name}: character grid must fill the layer`);
        for (const side of ['leftEdge', 'rightEdge']) {
          assert.ok(last[side].trim().length > 20, `${name}: missing ${side} characters`);
          assert.notEqual(last[side], first[side], `${name}: ${side} must animate`);
        }
        await page.screenshot({ path: `${output}/${name}.png` });
        const result = { name, width: last.width, renderedWidth: last.renderedWidth, animatedEdges: true };
        results.push(result);
        console.log(JSON.stringify(result));
      }
    }
    assert.deepEqual(errors, []);
    await context.close();
  } finally { await browser.close(); }
}
await fs.writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
