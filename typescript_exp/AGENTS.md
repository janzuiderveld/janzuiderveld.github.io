# Repository Guidelines

## Core Experience
- This site is ASCII-first. Keep the primary UI on a monospaced character grid: titles, navigation, tables, illustrations, frames, and overlays should read as text art, not standard web widgets.
- Photorealistic media is a secondary layer. Current project pages expose it through `[[VISUALS]]` and `#/slug?photo=1`. Do not replace ASCII navigation or layout with conventional DOM UI unless explicitly asked.
- Safari now follows the same supported path as Chromium across desktop and mobile, including project click/tap-to-photo entry and `?photo=1` routes. Unsupported browsers can still show the compatibility overlay.
- Photo mode now depends on a transparent input shield inside `src/components/photorealistic/PhotorealisticLayer.tsx` to forward wheel/touch scrolling and click/tap exit while leaving video wrappers above it interactive. Keep that layering intact when changing photo mode.
- When a photo-mode hero image looks missing below a video because the source PNG has large transparent margins, crop the rendered image content with `contentInsets` on the photo item. Do not move the saved `align` offsets or the wrapper bounds just to compensate for transparent padding in the asset.
- Transitions matter. The app uses white-in / white-out effects and route-entry animations; let the page settle before judging layout or capturing screenshots.
- Load white-in coordination now goes through `src/components/ascii-art2/autoWhiteIn.ts`. If you add another automatic white-in entry point, mark the current page as already handled before any async delay or remount boundary, or the intro can replay twice on dev remounts and other fast reload paths.

## Local Serving And Verification
- The app is served locally at `http://localhost:3000/`. Do not assume Vite defaults to `5173`; `vite.config.ts` pins the dev server to `3000`.
- Routing uses `HashRouter`, so test routes as `http://localhost:3000/#/…`.
- Always verify changes with Chrome DevTools MCP.
- For repeatable animation/performance work, there is now a local harness at `npm run profile:animation`. It uses `puppeteer-core` against the system Chrome binary and writes screenshots to `tmp/animation-profiles/`.
- Safari-family automation helpers now exist:
  - `npm run safari:webkit` for Playwright WebKit
  - `npm run safari:real` for real Safari through `safaridriver`
  - `npm run safari:stp` for Safari Technology Preview through `safaridriver`
- For Safari/WebKit animation work, trust the `<pre>` redraw metrics from `npm run safari:webkit`, not the raw page `requestAnimationFrame` count. The renderer intentionally self-throttles on Safari, so page `rAF` can still read ~60fps while visible ASCII redraws are lower.
- Hover reveal checks should only be expected on hover-capable devices. Touch devices should enter photo mode through links or taps instead of hover.
- Real Safari automation still needs one manual macOS step: `safaridriver --enable` (password prompt) and possibly `Develop > Allow Remote Automation` inside Safari.
- `xctrace` is present on the machine but not usable until full Xcode is selected; Command Line Tools alone are not enough.
- Minimum verification pass:
  - Desktop viewport around `1280x720`.
  - Tall/mobile viewport around `900x1600`.
  - When `?photo=1` centers on a supplemental video, also spot-check a shorter desktop height around `1280x600`; a frame that fits `720` headless can still feel clipped in a real browser window.
  - Wait about 1-2 seconds after navigation or reload so the renderer and intro effects finish.
- Prefer screenshots over accessibility text snapshots when validating visuals. The renderer collapses most of the experience into a giant ASCII field, so snapshots are often noisy while screenshots show the real result.
- The home page triggers a one-time intro ripple keyed by `sessionStorage.homeIntroRippleSeen`. For deterministic automation or screenshots, seed that key to `true` before loading `#/` or the synthetic center click can interfere with navigation and capture timing.
- Vimeo embeds can show a Chrome security restriction screen in headless verification runs. When that happens, still capture screenshots, but also verify wrapper behavior through DOM state such as `pointer-events`, scroll response, and route state.
- Project-page PDF exports use the `?pdf=1` query on a project route to hide the back / `[[VISUALS]]` controls and remove the hero ASCII block from the captured page. The PDF renderer keeps one full-page ASCII background/title/text capture, then overlays only the main image underneath it. It strips edge-connected white or transparent image backgrounds, derives a padded silhouette from the remaining subject, and erases the ASCII field behind that silhouette before drawing the cleaned image. Keep that erase pass cell-aligned to the character grid; blurred alpha masks look wrong next to the live site. The exporter evaluates wider capture viewports, but once the image clears a comfortable minimum size it should keep the smallest qualifying viewport so the exported letters stay as large as the website allows. For final image placement, do not measure the photo gap from the full padded text-blob tail alone; cap how much padded text clearance can push the image down, or tiny `gap` values will appear to do nothing. If a page has extra title-blob rows such as `title-callout` or `inline-photo-link`, place the injected `[link to web page]` below the lowest occupied title-area row instead of below `title` alone, or the export will overlap those lines. After the viewport-selection loop, reopen the route on a fresh page before taking the final capture; reusing the selection page can produce broken final frames on `#guide` / Personal Audio Guide. Do not run the image cleanup / silhouette extraction on the same page you plan to screenshot. Use the lightweight same-origin `public/pdf-processing-host.html` page for that work, and keep the real capture page in the foreground or use interval-based `waitForFunction` polling, because background-tab `requestAnimationFrame` polling can stall even when the ASCII DOM is already populated. `?pdf=1&pdfbg=1` still exists for background-only ASCII debugging. Generate single-page exports with `npm run render:project-pdf -- <slug>` and the fixed seven-page aggregate with `npm run render:project-pdf-collection`. The scripts write intermediates to `tmp/pdfs/` and final PDFs to `output/pdf/`.

## Chrome DevTools MCP Reset
1. Kill only the MCP server and the Chrome it launched:
   - `pkill -f chrome-devtools-mcp`
   - `pkill -f '/chrome-devtools-mcp/chrome-profile'`
   - if this Codex app session is using the persistent browser profile instead, also kill `pkill -f 'chrome-devtools-persistent'`
2. Clear stale locks:
   - `rm -f ~/.cache/chrome-devtools-mcp/chrome-profile/Singleton* 2>/dev/null || true`
   - for the persistent Codex Chrome profile, clear `rm -f ~/.codex/browser_profiles/chrome-devtools-persistent/Singleton* 2>/dev/null || true`
   - when running those cleanup commands from `zsh`, quote the glob or enable `nonomatch`; otherwise a missing `Singleton*` file aborts the command before `rm -f` runs
3. Start a fresh isolated session:
   - `npx chrome-devtools-mcp@latest --headless --isolated --viewport 1280x720 --logFile /tmp/mcp-devtools.log`
4. Also run a tall/mobile session when needed:
   - `npx chrome-devtools-mcp@latest --headless --isolated --viewport 900x1600 --logFile /tmp/mcp-devtools-mobile.log`
5. Load pages through hash routes:
   - Home: `http://localhost:3000/#/`
   - About: `http://localhost:3000/#/about`
   - Example project: `http://localhost:3000/#/coffee`
6. Wait briefly before taking screenshots so client rendering finishes.

### If MCP Says `Transport closed`
- Re-run the reset steps above first.
- Use Node `>= 20.19.0`.
- Check `/tmp/mcp-devtools.log`.
- Confirm Chrome exists at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`.

## Architecture And Route Map
- `src/main.tsx` is the real entry point. It initializes session white-in state and mounts `App` inside `HashRouter`.
- `src/index.tsx` is a legacy troubleshooting entry point, not the normal bootstrap. Do not update it instead of `src/main.tsx` by accident.
- `src/App.tsx` is the route registry. Current routes are:
  - `#/`
  - `#/about`
  - `#/camera`
  - `#/coffee`
  - `#/microwave`
  - `#/copy`
  - `#/fish`
  - `#/touching`
  - `#/lasers`
  - `#/shedrick`
  - `#/conversations-beyond-the-ordinary`
  - `#/presentations`
  - `#/vending`
  - `#/vending-demo`
  - `#guide` (the guide page is intentionally using a bare hash instead of `#/guide`)
  - `#/construction`
  - any unknown route redirects to `#/construction`
- `src/components/ascii-art2/*` is the active renderer, layout engine, link-overlay system, and animation stack. Prefer extending it instead of reviving code from `src/components/.ascii-art` or any `*.bak` file.
- `src/components/ProjectPage.tsx` is the shared shell for most project pages. It handles the title, back link, `[[VISUALS]]` control, `?photo=1` media mode, and optional media blocks anchored around the hero art.
- `ProjectPage` can now stack supplemental photo-mode media above or below the main hero anchor through `photoImages` and `photoVideos`. Supplemental media can size itself relative to the hero anchor or to the full page width, so use that instead of hard-coding standalone DOM media for project pages.
- `ProjectPage` also supports `extraPhotoItems` plus `photoLayoutAugmenter` for pages that need custom photo-mode galleries while still using the shared route shell. Extend those hooks before rebuilding a page-local photo-mode implementation.
- Treat saved photo alignment data as a stable artwork-to-ASCII contract. Do not tweak a page's main `align` offsets just to rebalance supplemental videos or galleries; solve that with supplemental bounds, scroll targets, or media sizing instead.
- When a user provides corrected alignment coordinates for a project image, save them in `src/assets/<project>/align.ts` and freeze them in the page test immediately. Do not casually retune those saved mappings later while working on unrelated video/layout adjustments.
- If a photo-mode video only feels too high or too low on entry while its raw spacing relative to the image is already correct, fix that with `photoInitialScrollTargetId`, `photoInitialScrollAlignment`, and `photoInitialScrollPaddingRows` instead of moving the artwork or changing the raw media gap.
- `photoVideos` / `photoImages` are positioned from the hero's ASCII anchor bounds before the main photo alignment offsets and scaling are applied. If a page's aligned hero image extends far above or below that anchor, override the supplemental bounds with `photoLayoutAugmenter` and consider a custom `photoInitialScrollTargetId` so `?photo=1` opens on the intended media stack.
- `ProjectPage` / `PhotoModeScene` also support top-aligned supplemental-media entry through `photoInitialScrollAlignment='start'` plus `photoInitialScrollPaddingRows`. Use that for smaller video blocks that should open near the top of the viewport instead of being centered like a hero image.
- When centering `?photo=1` on a stack that puts video above the hero image, point `photoInitialScrollTargetId` at a synthetic entry bound that spans the video and only the top slice of the image. Centering on the full hero height can still leave the above-video frame just off-screen.
- If a page should enter photo mode focused on the video itself rather than the whole media stack, target the generated supplemental video anchor directly, for example `hero-video-0`, instead of centering on the hero image.
- When a `ProjectPage` stack puts a video above the hero image and does not need a custom focus bound, explicitly set `photoInitialScrollTargetId='hero-video-0'`, `photoInitialScrollAlignment='start'`, `photoInitialScrollPaddingRows={5}`, and `photoCenterOnEnter={true}`. Default hero-centering will often hide the lead video off-screen on entry.
- Photo-mode video playback is coordinated centrally in `src/components/photorealistic/PhotoModeScene.tsx`, `src/components/photorealistic/InteractiveEmbedFrame.tsx`, and `src/components/photorealistic/videoPlayback.ts`. Keep autoplay / mute behavior there instead of reintroducing page-local iframe hacks.
- File-backed photo-mode videos should still opt into `autoplay`, but the shared scene now forces restart, unmutes, and restores volume when photo mode becomes visible.
- Vimeo photo-mode embeds should use normal Vimeo player URLs and let the shared embed helper normalize autoplay query params while preserving any explicit `muted=` choice from the page config.
- Keep `ProjectPage` photo-entry hit testing aligned with the same ASCII region that drives the hover-reveal preview. Do not fall back to making the title clickable just because the named `hero` overlay misses; the correct fix is to reuse the hover/photo-entry geometry for click and tap.
- Shared photorealistic hover/click geometry lives in `src/components/photorealistic/photoHitTest.ts`. Reuse that helper from `PhotoModeScene` and any future custom photo-mode entry logic instead of reintroducing page-specific name-overlay click targets.
- `src/pages/CameraPage.tsx` now uses `ProjectPage` with custom supplemental photo items and layout augmentation. Keep camera-specific gallery behavior inside that shared-page config unless the shared photo-mode scene becomes insufficient.
- `src/components/photorealistic/*` powers the media layer used by project photo mode.
- `src/components/photorealistic/PhotoModeScene.tsx` has an ASCII-side alignment mode for the main hero image: press `A` on the ASCII page, use arrows to move, `=` / `-` to scale, `[` / `]` and `,` / `.` to stretch, `S` to save locally, `Shift+S` to copy the JSON, and `R` / `Esc` to reset or exit.

## Content And Assets
- Most project pages are built from a bundle under `src/assets/<project>/`:
  - `<project>_ascii.txt`
  - `<project>_text.txt`
  - `align.ts`
  - `pictures/`
- Structured content is fetched from `public/*.csv`:
  - `upcoming_exhibitions.csv` for the homepage
  - `selected_presentations.csv`, `selected_awards.csv`, `selected_publications.csv` for `#/about`
  - `all_presentations.csv` for `#/presentations`
- When page media starts outside the repo, move or copy it into `src/assets/<project>/pictures/` or another project-owned path before embedding it. Do not wire website content directly to `Downloads`, absolute local filesystem paths, or other off-repo locations.
- If you change CSV schema or columns, update the matching parsers/formatters in `src/utils/*.ts` and keep fallback data in sync.
- Home and About both have fallback content in TypeScript so the pages still render if CSV fetches fail. Preserve that resilience unless the task explicitly removes it.
- Interactive controls are usually authored inside ASCII text with markdown-like link syntax. Prefer adding links inside rendered text instead of introducing standalone buttons.

## Build, Preview, And Deployment
- `npm run dev` starts Vite on `http://localhost:3000/`.
- `npm run build` runs `tsc -b && vite build`.
- `tsconfig.app.json` should exclude `src/**/*.test.*` and `src/**/*.spec.*` so colocated Vitest files do not get compiled as production app source during `npm run build`.
- `npm run preview` serves the built app on port `8000`.
- `npm run render:project-pdf -- <slug>` opens `#/slug?pdf=1` in headless Chrome, captures a single frozen page frame with the live ASCII background plus title/text, cleans the main image down to its detected subject silhouette, erases a padded blob from the captured ASCII field behind that silhouette on character-cell boundaries, and prints the one-page PDF composition. Re-render the PDF to PNG with `pdftoppm -png` when checking final output.
- `vite.config.ts` uses `base: '/'` because deployment copies the build output into the parent repository root.
- `deploy.sh` publishes from the parent repo, not from `typescript_exp` alone. It:
  1. builds inside `typescript_exp`
  2. changes to the parent repo
  3. copies `typescript_exp/dist/*` into the parent repo root
  4. runs `git add .`
  5. creates a commit with the fixed message `auto-commit`
  6. pushes
- Because `deploy.sh` mutates the parent repo root, inspect `git status` carefully before running it. Do not assume it only touches this subdirectory.

## Editing Conventions
- Use TypeScript + functional React components with hooks.
- Keep route-visible changes registered in `src/App.tsx`.
- Preserve the monochrome, light-background ASCII aesthetic unless the task is explicitly about changing the visual system.
- Prefer adding new project pages through `ProjectPage`, including custom photo-mode compositions via `extraPhotoItems` and `photoLayoutAugmenter`, unless the shared scene genuinely cannot support the experience.
- Keep homepage scatter offsets deterministic. Re-randomizing the anchored work positions during render/layout recalculation can destabilize tall-viewport layout correction and leave the route stuck on its white loading layer.
- When you add or change a project page, verify both `#/slug` and `#/slug?photo=1`.
- ASCII layout is fragile. After edits, check:
  - link overlays still line up with visible text
  - anchored text blobs do not collide on desktop
  - mobile/tall view either behaves intentionally or shows the compatibility overlay intentionally on unsupported browsers
  - photorealistic mode enters and exits cleanly

ALWAYS UPDATE THIS FILE WHEN PROJECT GUIDELINES CHANGE, OR YOU LEARN NEW THINGS THAT SHOULD BE DOCUMENTED FOR FUTURE CONTRIBUTORS.
