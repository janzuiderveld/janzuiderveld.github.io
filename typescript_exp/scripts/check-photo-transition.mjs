// Verify the actual first-entry path, fade alignment and deliberate photo entry.
import { chromium, firefox, webkit } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base = process.env.PREVIEW_URL || 'http://localhost:8000';
const output = process.env.CHECK_OUTPUT || 'tmp/browser-verification/photo-transition';
const engines = (process.env.CHECK_ENGINES || 'chrome,firefox,webkit').split(',');
await fs.mkdir(output, { recursive: true });
const results = [];
for (const name of engines) {
  const browser = await ({ chrome: chromium, firefox, webkit })[name].launch(name === 'chrome'
    ? { executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' } : {});
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true,
      ...(name === 'firefox' ? {} : { isMobile: true }) });
    await context.addInitScript(() => {
      sessionStorage.setItem('homeIntroRippleSeen', 'true');
      sessionStorage.setItem('sessionInitialized', 'true');
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const tap = (x, y) => name === 'firefox' ? page.mouse.click(x, y) : page.touchscreen.tap(x, y);
    await page.goto(`${base}/#/coffee`, { waitUntil: 'load' });
    await page.waitForTimeout(2400);
    let bounds = await page.locator('[data-photo-image]').first().boundingBox();
    // Leave space above the artwork and a fractional scroll remainder.
    const deltaY = (bounds.y - 280) / 0.7 + 3.7;
    if (name === 'webkit') await page.locator('pre').dispatchEvent('wheel', { deltaY, bubbles: true, cancelable: true });
    else await page.mouse.wheel(0, deltaY);
    await page.waitForTimeout(350);
    bounds = await page.locator('[data-ascii-click-target="hero"]').boundingBox();
    assert.ok(bounds && bounds.y > 100);
    const photoBounds = await page.locator('[data-photo-image]').first().boundingBox();
    assert.ok(bounds.width > photoBounds.width * 0.85, `${name}: artwork hit area must span the rendered art, not half of its character grid`);
    const x = Math.round(bounds.x + bounds.width / 2);
    await tap(x, bounds.y - 60);
    await page.waitForTimeout(1200);
    assert.equal(await page.locator('[data-photorealistic-visible="true"]').count(), 0, `${name}: nearby background must not enter photo mode`);
    // Also check just outside the bounds, inside the old padded hit overlay.
    await tap(x, bounds.y - 4);
    await page.waitForTimeout(1200);
    assert.equal(await page.locator('[data-photorealistic-visible="true"]').count(), 0, `${name}: artwork padding must not enter photo mode`);

    // Center the art for the transition test, putting both supplemental videos
    // outside the viewport. The checks above intentionally needed a larger gap.
    const centerDelta = (photoBounds.y - 20) / 0.7;
    if (name === 'webkit') await page.locator('pre').dispatchEvent('wheel', { deltaY: centerDelta, bubbles: true, cancelable: true });
    else await page.mouse.wheel(0, centerDelta);
    await page.waitForTimeout(350);
    bounds = await page.locator('[data-ascii-click-target="hero"]').boundingBox();

    for (const entry of ['artwork', 'visuals']) {
      await page.evaluate(() => {
        const layer = document.querySelector('[data-photorealistic-layer]');
        const pre = document.querySelector('pre');
        const ascii = pre.parentElement.parentElement;
        const image = layer.querySelector('img');
        const initialScroll = -new DOMMatrix(layer.firstElementChild.style.transform).m42;
        const started = performance.now();
        window.__photoTransition = { samples: [], initialScroll };
        const sample = () => {
          const time = performance.now() - started;
          window.__photoTransition.samples.push({ time,
            photoOpacity: Number(getComputedStyle(layer).opacity),
            asciiOpacity: Number(getComputedStyle(ascii).opacity),
            scroll: -new DOMMatrix(layer.firstElementChild.style.transform).m42,
            sameImage: layer.querySelector('img') === image,
            images: layer.querySelectorAll('img').length,
            filter: layer.querySelector('img')?.style.filter,
            videoCount: document.querySelectorAll('iframe,video').length });
          if (time < 1400) requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      });
      if (entry === 'artwork') await tap(x, Math.min(600, bounds.y + 160));
      else {
        const link = page.locator('[data-link-overlay][data-url*="photo=1"]').first();
        const box = await link.boundingBox();
        assert.ok(box, `${name}: VISUALS link must be present`);
        await tap(box.x + box.width / 2, box.y + box.height / 2);
      }
      await page.waitForTimeout(1600);
      assert.equal(await page.locator('[data-photorealistic-visible="true"]').count(), 1, `${name}: ${entry} must enter photo mode`);
      const capture = await page.evaluate(() => window.__photoTransition);
      const overlap = capture.samples.filter(s => s.photoOpacity > 0.05 && s.asciiOpacity > 0.05);
      assert.ok(overlap.length > 10, `${name}: the crossfade should animate`);
      assert.ok(overlap.every(s => Math.abs(s.scroll - capture.initialScroll) < 0.01), `${name}: keep the photo on the same ASCII rows throughout the overlap`);
      assert.ok(overlap.every(s => Math.abs(s.photoOpacity + s.asciiOpacity - 1) < 0.06), `${name}: fade both layers together`);
      assert.ok(capture.samples.every(s => s.sameImage && s.images === 1 && !s.filter.includes('blur')), `${name}: reuse the correctly aligned decoded image`);
      assert.ok(overlap.every(s => s.videoCount === 0), `${name}: offscreen media must wait for the fade`);
      await page.screenshot({ path: `${output}/${name}-${entry}.png` });
      await fs.writeFile(`${output}/${name}-${entry}.json`, JSON.stringify(capture, null, 2));
      await tap(20, 400);
      await page.waitForTimeout(1500);
      assert.equal(await page.locator('[data-photorealistic-visible="true"]').count(), 0);
    }
    const appErrors = errors.filter(message => !/player\.vimeo\.com.*accessing a frame/.test(message));
    assert.deepEqual(appErrors, []);
    const result = { engine: name, artworkEntry: true, visualsEntry: true, outsideTapsIgnored: true,
      alignedCrossfade: true, reusedImage: true, deferredOffscreenMedia: true };
    results.push(result); console.log(JSON.stringify(result));
    await context.close();
  } finally { await browser.close(); }
}
await fs.writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
