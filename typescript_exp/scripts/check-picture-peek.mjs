import { chromium, firefox, webkit } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base = process.env.PREVIEW_URL || 'http://localhost:8000';
const output = 'tmp/browser-verification/picture-peek';
await fs.mkdir(output, { recursive: true });
const active = '[data-photo-peek-active="true"]';
const photo = '[data-photorealistic-visible="true"]';
const results = [];
const peekWidth = async page => {
  await page.waitForFunction(selector => document.querySelector(selector)?.style.clipPath.startsWith('polygon('), `${active} > div`);
  return page.locator(`${active} > div`).evaluate(element => {
    const xs = element.style.clipPath.match(/-?[\d.]+(?=px)/g).map(Number).filter((_, i) => i % 2 === 0);
    return Math.max(...xs) - Math.min(...xs);
  });
};

async function openHero(page, mobileWebKit = false) {
  await page.goto(`${base}/#/coffee`, { waitUntil: 'load' });
  await page.waitForTimeout(2400);
  // ASCII hit overlays are culled while offscreen. The aligned photo wrapper
  // provides geometry before scrolling the hero into view.
  const hero = page.locator('[data-photo-image]').first();
  const box = await hero.boundingBox();
  assert.ok(box, 'Hero photo wrapper must exist');
  const deltaY = box.y + box.height / 2 - 430;
  if (mobileWebKit) {
    // Playwright cannot dispatch a native wheel to mobile WebKit. Positioning
    // is setup here; the assertions below exercise its touch event path.
    await page.locator('pre').dispatchEvent('wheel', { deltaY, bubbles: true, cancelable: true });
  } else await page.mouse.wheel(0, deltaY);
  await page.waitForTimeout(350);
  const visible = await hero.boundingBox();
  return { x: Math.round(visible.x + visible.width / 2), y: 430 };
}

async function syntheticTouch(page, type, point, count = 1) {
  await page.evaluate(({ type, point, count }) => {
    if (type === 'touchstart') window.__peekTouchTarget = document.elementFromPoint(point.x, point.y);
    const touch = { identifier: 1, clientX: point.x, clientY: point.y, target: window.__peekTouchTarget };
    const touches = type === 'touchend' || type === 'touchcancel' ? []
      : count === 2 ? [touch, { ...touch, identifier: 2 }] : [touch];
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperties(event, { touches: { value: touches }, changedTouches: { value: [touch] } });
    window.__peekTouchTarget.dispatchEvent(event);
  }, { type, point, count });
}

// Chromium receives trusted OS-style touch input through CDP. The other engines
// exercise the same touch listeners synthetically; this is not physical iOS QA.
for (const [name, engine] of [['chrome', chromium], ['firefox', firefox], ['webkit', webkit]]) {
  const browser = await engine.launch(name === 'chrome'
    ? { executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' } : {});
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true,
      ...(name === 'firefox' ? {} : { isMobile: true }) });
    await context.addInitScript(() => {
      sessionStorage.setItem('homeIntroRippleSeen', 'true');
      sessionStorage.setItem('sessionInitialized', 'true');
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const cdp = name === 'chrome' ? await context.newCDPSession(page) : null;
    const touch = (type, point, count = 1) => cdp ? cdp.send('Input.dispatchTouchEvent', {
      type: ({ touchstart: 'touchStart', touchmove: 'touchMove', touchend: 'touchEnd', touchcancel: 'touchCancel' })[type],
      touchPoints: type === 'touchend' || type === 'touchcancel' ? []
        : [{ ...point, id: 1 }, ...(count === 2 ? [{ x: point.x + 20, y: point.y, id: 2 }] : [])]
    }) : syntheticTouch(page, type, point, count);
    let point = await openHero(page, name === 'webkit');
    console.error(name, 'hero', point);
    await page.evaluate(() => {
      window.__peekGrowth = [];
      window.addEventListener('touchstart', () => {
        const started = performance.now();
        const sample = () => {
          const element = document.querySelector('[data-photo-peek-active="true"] > div');
          const xs = element?.style.clipPath.startsWith('polygon(')
            ? element.style.clipPath.match(/-?[\d.]+(?=px)/g).map(Number).filter((_, i) => i % 2 === 0) : [0];
          const elapsed = performance.now() - started;
          window.__peekGrowth.push({ elapsed, active: !!element, width: Math.max(...xs) - Math.min(...xs) });
          if (elapsed < 1250) requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      }, { once: true, capture: true, passive: true });
    });
    await touch('touchstart', point);
    await page.waitForSelector(active);
    console.error(name, 'peek active');
    await page.waitForFunction(() => {
      const image = document.querySelector('[data-photo-peek] img');
      return image?.complete && image.naturalWidth > 0;
    });
    console.error(name, 'image loaded');
    await page.waitForFunction(() => window.__peekGrowth.at(-1)?.elapsed >= 1200);
    const fingerWidth = await peekWidth(page);
    const growth = await page.evaluate(() => window.__peekGrowth);
    assert.ok(growth.find(sample => sample.active)?.width < fingerWidth * 0.15, `${name}: touch peek must start near zero`);
    assert.ok(growth.some(sample => sample.elapsed > 350 && sample.elapsed < 700
      && sample.width > fingerWidth * 0.15 && sample.width < fingerWidth * 0.85), `${name}: grow gradually over a second`);
    const coverage = await page.locator(`${active} > div`).evaluate(element => {
      const numbers = element.style.clipPath.match(/-?[\d.]+(?=px)/g).map(Number);
      const polygon = numbers.filter((_, i) => i % 2 === 0).map((x, i) => [x, numbers[i * 2 + 1]]);
      const bounds = document.querySelector('[data-photo-image]').getBoundingClientRect();
      let insideCount = 0;
      for (let row = 0; row < 10; row++) for (let col = 0; col < 10; col++) {
        const x = bounds.x + (col + 0.5) * bounds.width / 10;
        const y = bounds.y + (row + 0.5) * bounds.height / 10;
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
          const [xi, yi] = polygon[i], [xj, yj] = polygon[j];
          if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
        }
        if (inside) insideCount++;
      }
      return insideCount / 100;
    });
    assert.ok(coverage >= 0.85, `${name}: held peek should cover nearly all the artwork (${coverage})`);
    await page.screenshot({ path: `${output}/${name}-held.png` });
    await touch('touchend', point);
    if (!cdp) await page.evaluate(point => window.__peekTouchTarget.dispatchEvent(new MouseEvent('click', {
      bubbles: true, cancelable: true, detail: 1, clientX: point.x, clientY: point.y
    })), point);
    await page.waitForTimeout(1600);
    assert.equal(await page.locator(active).count(), 0, 'Releasing a hold clears the peek');
    assert.equal(await page.locator(photo).count(), 0, 'Releasing a hold must not act like a quick tap');
    await touch('touchstart', point);
    await page.waitForSelector(active);
    const restartedWidth = await peekWidth(page);
    assert.ok(restartedWidth < fingerWidth * 0.15, 'A new hold restarts growth from zero');
    const polygonCenter = () => page.locator(`${active} > div`).evaluate(element => {
      const numbers = element.style.clipPath.match(/-?[\d.]+(?=px)/g).map(Number);
      return numbers.filter((_, i) => i % 2 === 0).reduce((sum, n) => sum + n, 0) / (numbers.length / 2);
    });
    const startX = await polygonCenter();
    for (let i = 1; i <= 5; i++) {
      await touch('touchmove', { x: point.x + i * 16, y: point.y - i * 12 });
      await page.waitForTimeout(20);
    }
    await page.waitForTimeout(250);
    assert.ok(await polygonCenter() > startX + 40, `${name}: peek should follow finger horizontally`);
    assert.equal(await page.locator(photo).count(), 0, 'Dragging must keep ASCII mode');
    await page.screenshot({ path: `${output}/${name}-finger.png` });
    await touch('touchend', point);
    await page.waitForTimeout(250);
    assert.equal(await page.locator(active).count(), 0, 'Lifting must clear the peek');
    // Legacy compatibility mouse events must never resurrect the touch peek.
    await page.evaluate(point => window.dispatchEvent(new MouseEvent('mousemove', { clientX: point.x, clientY: point.y })), point);
    await page.waitForTimeout(50);
    assert.equal(await page.locator(active).count(), 0);

    for (const ending of ['touchcancel', 'multitouch', 'blur']) {
      point = await openHero(page, name === 'webkit');
      await touch('touchstart', point);
      await page.waitForSelector(active);
      if (ending === 'multitouch') {
        await touch('touchstart', point, 2);
        await page.waitForTimeout(50);
        assert.equal(await page.locator(active).count(), 0);
        await touch('touchcancel', point);
      } else if (ending === 'blur') {
        await page.evaluate(() => window.dispatchEvent(new Event('blur')));
        await touch('touchcancel', point);
      } else await touch(ending, point);
      await page.waitForTimeout(50);
      assert.equal(await page.locator(active).count(), 0, `${name}: clear on ${ending}`);
    }
    if (cdp) {
      point = await openHero(page);
      await page.touchscreen.tap(point.x, point.y);
      await page.waitForSelector(photo);
      assert.equal(await page.locator(active).count(), 0);
      await page.waitForTimeout(1200);
      await page.touchscreen.tap(25, 400);
      await page.waitForSelector(photo, { state: 'hidden' });
    }
    // Check the unchanged mouse interaction using an actual desktop context.
    const desktop = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const desktopPage = await desktop.newPage();
    desktopPage.setDefaultTimeout(15000);
    point = await openHero(desktopPage);
    await desktopPage.mouse.move(point.x, point.y);
    await desktopPage.waitForSelector(active);
    const mouseWidth = await peekWidth(desktopPage);
    assert.ok(mouseWidth > 650, `${name}: preserve the large mouse peek (${mouseWidth}px)`);
    await desktopPage.evaluate(() => document.dispatchEvent(new MouseEvent('mouseleave')));
    await desktopPage.waitForSelector(active, { state: 'hidden' });
    await desktop.close();
    assert.deepEqual(errors, []);
    results.push({ engine: name, trustedTouch: !!cdp, fingerWidthPx: Math.round(fingerWidth), mouseWidthPx: Math.round(mouseWidth), coverage,
      fingerTracking: true, releaseAndCancel: true,
      mouseHover: true, tapPhotoEntry: !!cdp });
    console.log(JSON.stringify(results.at(-1)));
    await context.close();
  } finally { await browser.close(); }
}
await fs.writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
