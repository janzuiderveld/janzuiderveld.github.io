# Repository Guidelines

## Core Experience
- This site is ASCII-first. Keep the primary UI on a monospaced character grid: titles, navigation, tables, illustrations, frames, and overlays should read as text art, not standard web widgets.
- Photorealistic media is a secondary layer. Current project pages expose it through `[[VISUALS]]` and `#/slug?photo=1`. Do not replace ASCII navigation or layout with conventional DOM UI unless explicitly asked.
- Safari now follows the same supported path as Chromium across desktop and mobile, including project click/tap-to-photo entry and `?photo=1` routes. Unsupported browsers can still show the compatibility overlay.
- Photo mode now depends on a transparent input shield inside `src/components/photorealistic/PhotorealisticLayer.tsx` to forward wheel/touch scrolling and click/tap exit while leaving video wrappers above it interactive. Keep that layering intact when changing photo mode.
- Transitions matter. The app uses white-in / white-out effects and route-entry animations; let the page settle before judging layout or capturing screenshots.

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
  - Wait about 1-2 seconds after navigation or reload so the renderer and intro effects finish.
- Prefer screenshots over accessibility text snapshots when validating visuals. The renderer collapses most of the experience into a giant ASCII field, so snapshots are often noisy while screenshots show the real result.
- Vimeo embeds can show a Chrome security restriction screen in headless verification runs. When that happens, still capture screenshots, but also verify wrapper behavior through DOM state such as `pointer-events`, scroll response, and route state.

## Chrome DevTools MCP Reset
1. Kill only the MCP server and the Chrome it launched:
   - `pkill -f chrome-devtools-mcp`
   - `pkill -f '/chrome-devtools-mcp/chrome-profile'`
2. Clear stale locks:
   - `rm -f ~/.cache/chrome-devtools-mcp/chrome-profile/Singleton* 2>/dev/null || true`
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
  - `#guide` (the guide page is intentionally using a bare hash instead of `#/guide`)
  - `#/construction`
  - any unknown route redirects to `#/construction`
- `src/components/ascii-art2/*` is the active renderer, layout engine, link-overlay system, and animation stack. Prefer extending it instead of reviving code from `src/components/.ascii-art` or any `*.bak` file.
- `src/components/ProjectPage.tsx` is the shared shell for most project pages. It handles the title, back link, `[[VISUALS]]` control, `?photo=1` media mode, and optional media blocks anchored around the hero art.
- `ProjectPage` can now stack supplemental photo-mode media above or below the main hero anchor through `photoImages` and `photoVideos`. Supplemental media can size itself relative to the hero anchor or to the full page width, so use that instead of hard-coding standalone DOM media for project pages.
- `src/pages/CameraPage.tsx` is the main custom page. It has its own photorealistic/hover-gallery flow and should not be treated like a normal `ProjectPage`.
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
- `npm run preview` serves the built app on port `8000`.
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
- Prefer adding new project pages through `ProjectPage` unless the experience truly needs a custom flow like `CameraPage`.
- Keep homepage scatter offsets deterministic. Re-randomizing the anchored work positions during render/layout recalculation can destabilize tall-viewport layout correction and leave the route stuck on its white loading layer.
- When you add or change a project page, verify both `#/slug` and `#/slug?photo=1`.
- ASCII layout is fragile. After edits, check:
  - link overlays still line up with visible text
  - anchored text blobs do not collide on desktop
  - mobile/tall view either behaves intentionally or shows the compatibility overlay intentionally on unsupported browsers
  - photorealistic mode enters and exits cleanly

ALWAYS UPDATE THIS FILE WHEN PROJECT GUIDELINES CHANGE, OR YOU LEARN NEW THINGS THAT SHOULD BE DOCUMENTED FOR FUTURE CONTRIBUTORS.
