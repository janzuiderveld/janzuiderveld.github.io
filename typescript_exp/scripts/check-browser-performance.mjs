// Production-build regression harness. Run before/after against separate previews.
import { chromium, firefox, webkit } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const base = process.env.CHECK_URL || 'http://localhost:8000';
const label = process.env.CHECK_LABEL || 'after';
const engines = (process.env.CHECK_ENGINES || 'chromium,firefox,webkit').split(',');
const output = path.resolve('tmp/browser-performance', label);
await fs.mkdir(output, { recursive: true });
const version = await fetch(`${base}/site-version.json`).then(response => response.json()).catch(() => null);
const meta = JSON.stringify({ base, buildId: version?.id ?? null });
const previousMeta = await fs.readFile(path.join(output, 'build.json'), 'utf8').catch(() => null);
const results = previousMeta === meta
  ? JSON.parse(await fs.readFile(path.join(output, 'results.json'), 'utf8').catch(() => '[]'))
  : [];
await fs.writeFile(path.join(output, 'build.json'), meta);
const seed = () => {
  sessionStorage.setItem('homeIntroRippleSeen', 'true');
  sessionStorage.setItem('sessionInitialized', 'true');
  sessionStorage.removeItem('needsWhiteIn');
  const raf = requestAnimationFrame;
  window.requestAnimationFrame = callback => raf(time => callback(window.__captureTime ?? time));
};
for (const engine of engines) {
  const browser = await ({ chromium, firefox, webkit })[engine].launch();
  try {
    for (const mobile of [false, true]) {
      const viewport = mobile ? { width: 390, height: 844 } : { width: 1280, height: 720 };
      const context = await browser.newContext({ viewport, hasTouch: mobile,
        ...(engine !== 'firefox' ? { isMobile: mobile } : {}),
        ...(mobile && engine === 'chromium' ? { userAgent: 'Mozilla/5.0 (Linux; Android 8.0.0; SM-G950F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.101 Mobile Safari/537.36' } : {})
      });
      await context.addInitScript(seed);
      for (const route of ['/', '/coffee', '/coffee?photo=1', '/camera?photo=1']) {
        const name = `${engine}-${mobile ? 'phone' : 'desktop'}-${route.replace(/[^a-z0-9]/gi, '-')}`;
        if (results.some(result => result.name === name)) continue;
        console.error(`Checking ${label} ${name}`);
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(`${base}/#${route}`, { waitUntil: 'load' });
        await page.waitForTimeout(2400);
        const warning = await page.locator('.compatibility-overlay').count();
        if (label !== 'before') assert.equal(warning, 0, `${name}: compatibility warning`);
        // Baseline Android/Firefox needs its old warning to finish before measuring.
        if (warning) await page.waitForTimeout(5500);
        const pre = page.locator('pre').first();
        await pre.waitFor();
        assert.ok((await pre.textContent()).length > 200, `${name}: missing ASCII`);
        const photo = route.includes('photo=1');
        const input = photo ? '[data-photo-input-shield]' : 'pre';
        if (photo) {
          await page.waitForFunction(() => document.querySelector('[data-photorealistic-visible="true"]'));
        }
        const geometry = await page.evaluate(() => ({
          pre: (() => { const p = document.querySelector('pre'); const s = getComputedStyle(p); return { font: s.font, lineHeight: s.lineHeight, color: s.color, width: p.clientWidth, height: p.clientHeight }; })(),
          links: [...document.querySelectorAll('[data-link-overlay]')].map(a => ({
            href: a.getAttribute('href') || a.dataset.url, text: a.textContent,
            left: a.style.left, top: a.style.top, width: a.style.width, height: a.style.height
          })),
          images: [...document.querySelectorAll('[data-photo-image]')].map(i => ({style: i.getAttribute('style'), src: i.querySelector('img')?.getAttribute('src')?.split('/').pop()}))
        }));
        await page.screenshot({ path: path.join(output, `${name}.png`) });
        const metrics = await page.evaluate(async ({ input, photo }) => {
          const pre = document.querySelector('pre');
          let redraws = 0;
          let lastMutation = 0;
          const gaps = [];
          const observer = new MutationObserver(() => {
            const now = performance.now();
            if (lastMutation) gaps.push(now - lastMutation);
            lastMutation = now;
            redraws++;
          });
          observer.observe(pre, { childList: true, characterData: true, subtree: true });
          await new Promise(resolve => setTimeout(resolve, 1000));
          const idleRedraws = redraws;
          redraws = 0;
          gaps.length = 0;
          lastMutation = 0;
          const target = document.querySelector(input);
          const gestureTimes = [];
          // A shared scroll landmark, independent of React implementation details.
          const landmark = photo ? document.querySelector('[data-photorealistic-layer] > div') : document.querySelector('[data-link-overlay]');
          const position = () => photo
            ? new DOMMatrix(getComputedStyle(landmark).transform).m42
            : parseFloat(landmark?.style.top || '0');
          const dispatch = (type, y) => {
            const point = { identifier: 7, clientX: 195, clientY: y };
            const event = new Event(type, { bubbles: true, cancelable: true });
            Object.defineProperties(event, {
              touches: { value: type === 'touchend' ? [] : [point] },
              changedTouches: { value: [point] }
            });
            target.dispatchEvent(event);
            gestureTimes.push({ type, time: performance.now() });
          };
          const startPosition = position();
          dispatch('touchstart', 650);
          await new Promise(resolve => setTimeout(resolve, 350));
          for (let i = 1; i <= 8; i++) {
            dispatch('touchmove', 650 - i * 22);
            await new Promise(resolve => setTimeout(resolve, 16));
          }
          const releasePosition = position();
          dispatch('touchend', 474);
          await new Promise(resolve => setTimeout(resolve, 500));
          const coastPosition = position();
          observer.disconnect();
          return { idleRedraws, movingRedraws: redraws, maxRedrawGapMs: Math.max(0, ...gaps),
            releasePauseMs: gestureTimes[gestureTimes.length - 1].time - gestureTimes[gestureTimes.length - 2].time,
            dragPx: startPosition - releasePosition, coastPx: releasePosition - coastPosition,
            imageCount: document.images.length,
            scriptBytes: performance.getEntriesByType('resource').filter(e => e.name.endsWith('.js')).reduce((s,e) => s + e.decodedBodySize, 0)
          };
        }, { input, photo });
        // Photo-mode transform is a continuous, reliable position measurement.
        if (label !== 'before' && photo) assert.ok(metrics.coastPx > 80, `${name}: missing momentum ${JSON.stringify(metrics)}`);
        // Vimeo itself probes its cross-origin parent in WebKit. Keep the
        // provider error in the report, separate from application exceptions.
        const appErrors = errors.filter(message => !/player\.vimeo\.com.*accessing a frame/.test(message));
        assert.equal(appErrors.length, 0, `${name}: ${appErrors.join('; ')}`);
        results.push({ name, warning, errors, geometry, ...metrics });
        await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
        console.log(JSON.stringify({ name, warning, ...metrics }));
        await page.close();
      }
      await context.close();
    }
  } finally { await browser.close(); }
}
