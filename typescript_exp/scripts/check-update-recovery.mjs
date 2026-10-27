import { chromium, firefox, webkit } from 'playwright';
import assert from 'node:assert/strict';
import { build } from 'vite';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';

// Model a real Pages deployment: the old route chunk disappears, and the new
// HTML imports genuinely new hashed modules. Re-serving an identical failed
// module URL is not equivalent: WebKit can retain that module's failed state.
const fixtures = path.resolve('tmp/browser-performance/update-recovery');
for (const generation of ['old', 'new']) {
  await build({ publicDir: false, logLevel: 'error', build: {
    outDir: path.join(fixtures, generation), emptyOutDir: true
  } });
}
const oldVersion = JSON.parse(await fs.readFile(path.join(fixtures, 'old/site-version.json'), 'utf8')).id;
const newVersion = JSON.parse(await fs.readFile(path.join(fixtures, 'new/site-version.json'), 'utf8')).id;
assert.notEqual(oldVersion, newVersion);
let generation = 'old';
let missingChunks = 0;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.csv': 'text/csv', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const server = http.createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
  if (relative.split('/').includes('..')) { response.writeHead(400).end(); return; }
  let data = await fs.readFile(path.join(fixtures, generation, relative)).catch(() => null);
  if (!data && !pathname.startsWith('/assets/')) data = await fs.readFile(path.resolve('public', relative)).catch(() => null);
  if (!data) {
    if (/\/FishPage-[^/]+\.js$/.test(pathname)) missingChunks++;
    response.writeHead(404, { 'cache-control': 'no-store' }).end('Removed deployment asset');
    return;
  }
  response.writeHead(200, { 'content-type': types[path.extname(relative)] || 'application/octet-stream', 'cache-control': 'no-store' });
  response.end(data);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const deploymentBase = `http://127.0.0.1:${server.address().port}`;
try {
for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
  if (process.env.CHECK_ENGINES && !process.env.CHECK_ENGINES.split(',').includes(name)) continue;
  const browser = await engine.launch();
  try {
    const context = await browser.newContext();
    await context.addInitScript(() => {
      sessionStorage.setItem('sessionInitialized', 'true');
      sessionStorage.setItem('homeIntroRippleSeen', 'true');
    });
    const page = await context.newPage();
    let manifestRequests = 0;
    let documentRequests = 0;
    page.on('request', request => {
      if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documentRequests++;
    });
    await page.route('**/site-version.json?*', route => {
      manifestRequests++;
      return route.fulfill({ json: { id: 'synthetic-new-deployment' } });
    });
    await page.goto('http://localhost:8000/?keep=1#/coffee?photo=1');
    await page.waitForURL('**/?keep=1&v=synthetic-new-deployment#/coffee?photo=1');
    await page.waitForFunction(() => document.querySelector('[data-photorealistic-visible="true"]'));
    await page.waitForTimeout(1500);
    assert.equal(documentRequests, 2, `${name}: refresh loop or missing document refresh`);
    assert.ok(manifestRequests >= 2, `${name}: missing manifest check`);
    assert.equal(await page.locator('.compatibility-overlay').count(), 0);
    // Explicit reload with a stale shell must not cause a second auto-refresh.
    await page.reload();
    await page.waitForTimeout(1500);
    assert.equal(documentRequests, 3, `${name}: reload-loop guard failed`);
    await page.unroute('**/site-version.json?*');
    await page.route('**/site-version.json?*', route => route.abort());
    await page.goto('http://localhost:8000/#/');
    await page.waitForTimeout(1800);
    assert.ok((await page.locator('pre').first().textContent()).length > 200);
    await page.unroute('**/site-version.json?*');
    generation = 'old';
    missingChunks = 0;
    await page.goto(`${deploymentBase}/#/`);
    await page.waitForFunction(() => document.querySelector('pre')?.textContent.length > 200);
    await page.waitForTimeout(1000);
    generation = 'new';
    await page.evaluate(() => { window.location.hash = '/fish'; });
    await page.waitForURL(`${deploymentBase}/?v=${newVersion}#/fish`);
    await page.waitForFunction(() => document.querySelector('pre')?.textContent.length > 200);
    assert.ok(missingChunks > 0, `${name}: removed lazy chunk was not requested`);
    console.log(`${name}: stale build recovery, route preservation, repeat-reload guard, offline-manifest fallback and removed lazy chunk recovery passed`);
  } finally { await browser.close(); }
}
} finally { await new Promise(resolve => server.close(resolve)); }
