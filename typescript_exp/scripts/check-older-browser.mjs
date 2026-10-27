import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await page.addInitScript(() => {
    Object.fromEntries = undefined;
    Array.prototype.flatMap = undefined;
    Promise.allSettled = undefined;
    window.ResizeObserver = undefined;
    sessionStorage.setItem('homeIntroRippleSeen', 'true');
    sessionStorage.setItem('sessionInitialized', 'true');
  });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const route of ['/', '/coffee', '/camera?photo=1', '/biodiesellm']) {
    await page.goto(`${process.env.CHECK_URL || 'http://localhost:8000'}/#${route}`);
    await page.waitForTimeout(2200);
    assert.deepEqual(errors, [], `${route}: startup errors with older browser APIs`);
    assert.ok((await page.locator('pre').first().textContent()).length > 200, `${route}: missing ASCII`);
    assert.equal(await page.locator('.compatibility-overlay').count(), 0);
  }
  console.log('Older-API browser smoke checks passed on four routes (synthetic; not an old physical phone).');
} finally { await browser.close(); }
