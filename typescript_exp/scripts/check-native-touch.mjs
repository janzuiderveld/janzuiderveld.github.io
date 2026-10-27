import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
try {
  for (const cpuRate of [1, 4]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    await context.addInitScript(() => {
      sessionStorage.setItem('homeIntroRippleSeen', 'true');
      sessionStorage.setItem('sessionInitialized', 'true');
    });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuRate });
    for (const route of ['/', '/coffee?photo=1']) {
      await page.goto(`http://localhost:8000/#${route}`, { waitUntil: 'load' });
      await page.waitForTimeout(2800);
      const photo = route.includes('photo=1');
      const position = () => page.evaluate(photo => photo
        ? new DOMMatrix(getComputedStyle(document.querySelector('[data-photorealistic-layer] > div')).transform).m42
        : parseFloat(document.querySelector('[data-link-overlay]')?.style.top || '0'), photo);
      const touch = (type, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: 25, y, id: 1 }] });
      await touch('touchStart', 650);
      await page.waitForTimeout(350);
      for (let i = 1; i <= 8; i++) {
        await touch('touchMove', 650 - i * 22);
        await page.waitForTimeout(16);
      }
      const released = await position();
      await touch('touchEnd');
      await page.waitForTimeout(500);
      const coast = released - await position();
      assert.ok(coast > 70, `${route} ${cpuRate}x CPU: real input failed to coast (${coast})`);
      // Touching again must stop the active fling immediately, without exiting photo mode.
      await touch('touchStart', 650);
      const stopped = await position();
      await page.waitForTimeout(180);
      const end = await position();
      assert.ok(Math.abs(stopped - end) < 2, `${route} ${cpuRate}x: stop ${stopped} -> ${end}`);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
      if (photo) {
        assert.equal(await page.locator('[data-photorealistic-visible="true"]').count(), 1);
        await page.touchscreen.tap(25, 450);
        await page.waitForTimeout(1800);
        assert.equal(await page.locator('[data-photorealistic-visible="true"]').count(), 0);
      }
      console.log(JSON.stringify({ browser: await browser.version(), route, cpuRate, coastPx: coast, stopAndTapPassed: true }));
    }
    await context.close();
  }
} finally { await browser.close(); }
