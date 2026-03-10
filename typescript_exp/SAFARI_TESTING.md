# Safari Testing Setup

This repo now has two Safari-family test paths:

- `npm run safari:webkit`
  - Uses Playwright WebKit.
  - Best for repeatable automated checks in CI-style runs.
  - Good approximation of Safari rendering behavior, but not identical to Safari.app.

- `npm run safari:real`
  - Uses Selenium WebDriver against the system `safaridriver`.
  - Drives the real Safari browser.

- `npm run safari:stp`
  - Same as `safari:real`, but targets Safari Technology Preview.
  - Requires Safari Technology Preview to be installed.

## What Is Installed

- `playwright`
- `selenium-webdriver`
- Playwright WebKit browser bundle

## Manual Prerequisites

### Real Safari automation

One-time manual setup is still required by macOS:

```bash
safaridriver --enable
```

That command prompts for your local password and cannot be completed non-interactively here.

After that, Safari may also require:

- `Develop > Allow Remote Automation`

### Safari Technology Preview

The install was attempted, but macOS package install requires `sudo`, so it was not completed automatically in this session.

Manual install:

```bash
brew install --cask safari-technology-preview
```

## Commands

```bash
npm run safari:webkit
npm run safari:real
npm run safari:stp
```

## Output

Artifacts are written to:

- `tmp/safari-checks/webkit/`
- `tmp/safari-checks/safari/`
- `tmp/safari-checks/technology-preview/`

Each run writes:

- screenshots
- `summary.json`

For `npm run safari:webkit`, `summary.json` now reports both:

- `pageFps`: raw page `requestAnimationFrame` cadence
- `redrawFps`: actual `<pre>` redraw cadence for the ASCII renderer

Use `redrawFps` as the real animation smoothness metric for this project.

## Notes

- The scripts pre-seed session storage so Safari-family runs bypass the compatibility overlay and test the actual routes.
- Full system profiling with `xctrace` is not available yet because the machine currently has Command Line Tools selected instead of full Xcode.
