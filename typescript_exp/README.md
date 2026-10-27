# warana.xyz — ASCII portfolio

React/TypeScript artwork website. Source is in `src/`; Vite builds `dist/`. The parent repository deploys `dist/` to GitHub Pages on `gh-pages`. Start with [AGENTS.md](AGENTS.md) for artwork/layout invariants and deployment conventions.

## Development and verification

Use `npm ci`, then `npm run dev` (port 3000). Routes use hashes, for example `/#/coffee` and `/#/coffee?photo=1`. Use the project-root `.venv` for any Python work.

Design tests before changes. Run `npm test` and `npm run build`. On Node 25, supply an explicit local-storage file as described in AGENTS.md. For production browser checks, run `npm run preview -- --port 8000 --strictPort` and install the test engines once with `npx playwright install chromium firefox webkit`.

| Command | What it verifies |
| --- | --- |
| `npm run check:browsers` | Chromium, Firefox, WebKit; 1280×720 and 390×844; home, coffee ASCII/photo, camera photo; actual ASCII redraw cadence, gestures, warnings, errors and media/link geometry. |
| `npm run check:touch` | System Chrome's trusted touch input, normal and 4× CPU slowdown; fling, touch-to-stop, video controls and photo exit. |
| `npm run check:updates` | Stale entry recovery, hash/query preservation, reload-loop guard, unavailable-manifest fallback and recovery from removed lazy chunks in all three engines. |
| `npm run check:older-browsers` | Four routes with Object.fromEntries, Array.flatMap, Promise.allSettled and ResizeObserver absent. This is a synthetic API check, not physical legacy-device certification. |
| `npm run check:visuals` | Frozen, pixel-for-pixel before/after captures of seven routes at desktop, phone and tall widths. Requires an original production preview on port 8001 and the current one on 8000. |

Browser results are written under ignored `tmp/browser-performance/`. `CHECK_URL`, `CHECK_LABEL` and `CHECK_ENGINES` configure `check:browsers`; its resume cache is tied to the build manifest. Keep the before build in `tmp/performance-before/` and serve it with `npm run preview -- --outDir tmp/performance-before --port 8001 --strictPort`. The older `profile:animation` CPU profiler remains useful; its page rAF count is not the renderer's actual redraw rate. The `safari:webkit` legacy innerHTML probe misses cached text-node updates.

Real Safari requires WebDriver remote automation to be enabled. WebKit tests cover the engine but do not establish physical iPhone or installed Safari behavior. Edge shares Chromium's engine; test installed Edge separately when available. Screenshots and geometry checks must accompany performance measurements: this site's appearance is part of the artwork.

## Scrolling and rendering

The fixed ASCII canvas uses virtual scrolling, so the browser cannot supply native document inertia. `useScrolling` tracks recent finger movement, computes release speed in pixels/ms and integrates an exponential decay over elapsed time. The same gesture travels the same distance at 30/60/120 Hz. Holds, cancellation, multi-touch, focus loss and touches on media controls stop momentum. Photo mode forwards all touch phases through the shared scroll controller, retaining the transparent shield and interactive video layering.

Wheel events already contain trackpad/OS inertia. Normalize their pixel/line/page units, but do not add another fling to each event. The renderer maintains a fractional 60 Hz deadline with a small clock tolerance, and pauses work when hidden. Do not change fonts, glyph maps, saved alignment, image assets or grid sizes as a performance shortcut.

## Build compatibility and caching

Vite targets Chrome 64, Edge 79, Firefox 67 and Safari 12 syntax. This is the compilation baseline, not a claim that those old engines or every phone have been tested. Avoid APIs missing from that baseline in startup code. Project pages load lazily; Home stays eager. The generated Vite preloader uses Promise.allSettled independently of the syntax target; main.tsx loads its core-js polyfill before the application.

There is no service worker. The former browser-name allowlist classified all Android browsers and Firefox as unsupported and displayed a warning even from a fresh, current bundle. The application does not mount that warning.

GitHub Pages controls HTTP response headers; an HTML meta tag or `_headers` file cannot replace its cache policy. The October 2026 live homepage response had `Cache-Control: max-age=600`. Mutable CSVs explicitly revalidate with `cache: 'no-cache'`; fingerprinted scripts and artwork remain cacheable.

Each build emits `site-version.json` and embeds the same build ID into the client. Production checks freshness on entry/return to a visible tab (at most once per minute, no polling timer). A different version triggers a guarded refresh with a new query value, preserving the hash route. An old lazy route chunk removed by deployment triggers the same recovery. Missing manifests, offline requests and blocked session storage do not force repeated reloads. This mechanism takes effect after a visitor has loaded a build containing it; it cannot retroactively execute inside a previously downloaded older application.

## References

- [MDN: animation timestamps and refresh rates](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)
- [MDN: touch-action and custom gesture ownership](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/touch-action)
- [Chrome: touch listeners and scrolling responsiveness](https://developer.chrome.com/blog/scrolling-intervention)
- [MDN: wheel delta units](https://developer.mozilla.org/en-US/docs/Web/API/WheelEvent/deltaMode)
- [Vite 6: production browser targets and API polyfills](https://v6.vite.dev/guide/build)
- [MDN: HTTP caching](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching) and [request cache modes](https://developer.mozilla.org/en-US/docs/Web/API/Request/cache)
