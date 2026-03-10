# Animation Optimization Report

Date: March 10, 2026

## Goal

Keep the existing ASCII look, white-in/white-out transitions, and interaction model unchanged while making the site stay comfortably above the requested 24 FPS floor, including on slower CPUs.

## Verification Setup

- Local app URL: `http://localhost:3000/`
- Desktop route checks:
  - `#/`
  - `#/coffee`
  - `#/camera`
- Viewports:
  - Desktop: `1280x720`
  - Tall: `900x1600`
- Animation settle delay before capture: about `2.2s`
- Measurement harness: `npm run profile:animation`
- Harness implementation: [`scripts/profile-animation.mjs`](./scripts/profile-animation.mjs)
- Browser engine: system Google Chrome through `puppeteer-core`
- CPU throttle for perf numbers: `4x`

Note: Chrome DevTools MCP transport was unavailable in this session (`Transport closed`), so I used the same Chrome DevTools Protocol through `puppeteer-core` to keep the profiling repeatable and Chromium-based.

## Before

The site was already fine while idle. The real problem was scroll-time animation cost on throttled CPU.

| Scenario | FPS before | Long tasks before |
| --- | ---: | ---: |
| Home scroll | 38.7 | 7 (`734ms`) |
| Coffee scroll | 28.5 | 31 (`2116ms`) |
| Camera scroll | 35.0 | 36 (`2689ms`) |

Dominant hotspot before:

- `src/components/ascii-art2/hooks/useBlobCache.ts`
- Full blob-cache rebuilds were dominating every scroll trace.
- Secondary cost came from React/DOM churn around link overlays and continuously running scroll bookkeeping.

## After

Final throttled measurements on the current code:

| Scenario | FPS after | Long tasks after |
| --- | ---: | ---: |
| Home idle | 118.9 | 0 |
| Home scroll | 112.5 | 0 |
| Coffee idle | 120.1 | 0 |
| Coffee scroll | 114.1 | 0 |
| Camera idle | 120.1 | 0 |
| Camera scroll | 119.7 | 0 |

Result:

- The requested `24+ FPS` target is exceeded with wide margin in every measured desktop scenario, even under `4x` CPU throttling.
- After the fixes, the traces are dominated by `calculateCharacter` and `animate`, which are the actual visual effect generation path rather than wasted rebuild work.

## What Worked

### 1. Split blob cache into fixed and scroll planes

Files:

- [`src/components/ascii-art2/hooks/useBlobCache.ts`](./src/components/ascii-art2/hooks/useBlobCache.ts)
- [`src/components/ascii-art2/renderer.ts`](./src/components/ascii-art2/renderer.ts)
- [`src/components/ascii-art2/types.ts`](./src/components/ascii-art2/types.ts)
- [`src/components/ascii-art2/AsciiArtGenerator.tsx`](./src/components/ascii-art2/AsciiArtGenerator.tsx)

Change:

- Replaced the scroll-relative blob-cache rebuild strategy with two persistent caches:
  - one for fixed content
  - one for scrollable content in document coordinates
- Renderer now reads the appropriate cache plane instead of forcing a full rebuild during scroll.

Why it worked:

- This removed the main scroll hotspot entirely.
- It preserved the blob look because the renderer still resolves fixed and scrolled characters separately.

Measured effect:

- Home scroll: `38.7 -> 109.5+ FPS` immediately after this change
- Coffee scroll: `28.5 -> 117.7+ FPS`
- Camera scroll: `35.0 -> 119.5+ FPS`

### 2. Remove perpetual scroll RAF work

File:

- [`src/components/ascii-art2/hooks/useScrolling.ts`](./src/components/ascii-art2/hooks/useScrolling.ts)

Change:

- Replaced the always-running `requestAnimationFrame` loop with an on-demand momentum loop that only runs while touch drag or inertia is active.

Why it worked:

- It reduced idle bookkeeping and removed a permanent competing loop from the page lifecycle.
- It did not materially change visual FPS after the blob-cache refactor, but it reduced wasted runtime work and made the scroll system cleaner.

### 3. Stop remounting link overlays every scroll tick

Files:

- [`src/components/ascii-art2/AsciiArtGenerator.tsx`](./src/components/ascii-art2/AsciiArtGenerator.tsx)
- [`src/components/ascii-art2/hooks/useLinks.ts`](./src/components/ascii-art2/hooks/useLinks.ts)

Change:

- Made overlay keys stable instead of including `linkY`.
- Removed no-op overlay revision state churn.
- Removed debug logging from hot click/link paths.

Why it worked:

- It reduced React diff/remount noise during scroll.
- The gain was secondary, but it lowered residual DOM overhead after the main renderer fix.

### 4. Stop using React state as a frame-by-frame transport for cursor/transition internals

File:

- [`src/components/ascii-art2/hooks/useCursor.ts`](./src/components/ascii-art2/hooks/useCursor.ts)

Change:

- Kept `cursorRef` as the real animation state.
- Removed unnecessary `setCursor(...)` calls for mouse movement, ripples, and per-frame white-in/white-out progress updates.
- Kept React state updates only where render-visible flags actually change.

Why it worked:

- Preserved the exact visual effect because the renderer already reads `cursorRef.current`.
- Reduced rerender pressure during interaction and transitions.

### 5. Remove route/init debug logging

Files:

- [`src/App.tsx`](./src/App.tsx)
- [`src/main.tsx`](./src/main.tsx)

Change:

- Removed route-level and bootstrap `console.log(...)` noise.

Why it worked:

- Small win, mostly cleanup.
- Good to remove while tightening animation-heavy pages.

### 6. Fix homepage tall-viewport instability

File:

- [`src/pages/HomePage.tsx`](./src/pages/HomePage.tsx)

Change:

- Replaced render-time random scatter with deterministic scatter from a stable hash.
- Kept the white loading layer as a one-time boot state instead of re-entering it during layout correction.

Why it worked:

- Prevented the home route from getting stuck on a blank white loading layer in the tall `900x1600` check.
- Also removed a subtle source of unnecessary layout churn.

## What I Tried That Did Not Help Enough

### 1. Scroll-loop cleanup alone

- Cleaning `useScrolling` without fixing blob-cache rebuilds was not enough.
- The traces were still dominated by `useBlobCache.ts` before the cache-plane refactor.

### 2. Link-overlay cleanup alone

- Stable keys and reduced overlay state churn were worthwhile, but they were not the primary win.
- They only mattered after the blob-cache rebuilds were removed.

### 3. Profiling with `networkidle0`

- Not a runtime optimization, but part of the investigation.
- It failed on media-heavy routes because embedded/video pages never became truly network-idle.
- Switched the harness to `domcontentloaded + settle delay`, which produced stable measurements.

## Directions I Explicitly Rejected

These would have risked changing the current look or behavior too much:

- Lowering animation fidelity or reducing effect complexity visibly
- Reducing blob radius or altering blob shape
- Lowering transition duration or changing white-in/white-out timing
- Switching the renderer to canvas/WebGL
- Removing overlay hit areas or simplifying the ASCII navigation model

## Remaining Ceiling

After the final pass, the top remaining runtime cost is:

- [`src/components/ascii-art2/renderer.ts`](./src/components/ascii-art2/renderer.ts) `calculateCharacter`
- [`src/components/ascii-art2/hooks/useAnimation.ts`](./src/components/ascii-art2/hooks/useAnimation.ts) `animate`

That is expected. At this point the cost is mostly the actual visual computation that produces the current aesthetic. Further large gains would likely require changing the look, the temporal behavior, or the rendering backend.

## Files Changed

- [`package.json`](./package.json)
- [`package-lock.json`](./package-lock.json)
- [`scripts/profile-animation.mjs`](./scripts/profile-animation.mjs)
- [`src/App.tsx`](./src/App.tsx)
- [`src/main.tsx`](./src/main.tsx)
- [`src/pages/HomePage.tsx`](./src/pages/HomePage.tsx)
- [`src/components/ascii-art2/types.ts`](./src/components/ascii-art2/types.ts)
- [`src/components/ascii-art2/renderer.ts`](./src/components/ascii-art2/renderer.ts)
- [`src/components/ascii-art2/AsciiArtGenerator.tsx`](./src/components/ascii-art2/AsciiArtGenerator.tsx)
- [`src/components/ascii-art2/hooks/useBlobCache.ts`](./src/components/ascii-art2/hooks/useBlobCache.ts)
- [`src/components/ascii-art2/hooks/useScrolling.ts`](./src/components/ascii-art2/hooks/useScrolling.ts)
- [`src/components/ascii-art2/hooks/useCursor.ts`](./src/components/ascii-art2/hooks/useCursor.ts)
- [`src/components/ascii-art2/hooks/useLinks.ts`](./src/components/ascii-art2/hooks/useLinks.ts)
- [`AGENTS.md`](./AGENTS.md)

## Artifacts

Generated screenshots and profiling captures live under:

- [`tmp/animation-profiles/`](./tmp/animation-profiles/)

Useful screenshots from the final pass:

- [`tmp/animation-profiles/final-home-desktop.png`](./tmp/animation-profiles/final-home-desktop.png)
- [`tmp/animation-profiles/final-home-tall-fixed.png`](./tmp/animation-profiles/final-home-tall-fixed.png)
- [`tmp/animation-profiles/final-coffee-desktop.png`](./tmp/animation-profiles/final-coffee-desktop.png)

## Commands Run

```bash
npm install -D puppeteer-core
npm run build
npm run profile:animation
```
